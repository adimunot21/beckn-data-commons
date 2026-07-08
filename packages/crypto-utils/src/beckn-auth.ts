/**
 * Per-hop message authentication for BDC Beckn traffic.
 *
 * The Access Grant proves *what a consumer may do*. This layer proves *who sent a
 * given Beckn message and that it is fresh* — so a BPP will not act on a forged or
 * replayed `discover`/`select`/`init`/`confirm`, and a BAP will not accept a
 * callback from an impostor.
 *
 * SCHEME (BDC message auth v1 — inspired by Beckn's HTTP Signature auth, but a
 * clean self-contained Ed25519 scheme we define, since we are not signing against
 * a live Fabric whose exact header grammar/digest we have not captured):
 *
 *   signingBase = `${keyId}\n${created}\n${expires}\n${nonce}\n${canonicalJson(body)}`
 *   signature   = Ed25519(signingBase, senderPrivateKey)   // hex
 *   header      = Signature keyId="…",algorithm="ed25519",
 *                 created="<unixSec>",expires="<unixSec>",nonce="<hex>",signature="<hex>"
 *
 * The header does NOT carry the body — the verifier re-canonicalizes the request
 * body it actually received, so any tampering breaks the signature. `created`/
 * `expires` bound a short validity window (replay is cheap outside it); `nonce`
 * makes each message single-use inside the window via a ReplayCache.
 */
import { randomBytes } from 'node:crypto';
import { canonicalJson, type JsonValue } from './canonical.js';
import { sign, verify } from './ed25519.js';

const DEFAULT_TTL_SECONDS = 30;
const DEFAULT_CLOCK_SKEW_SECONDS = 5;

export type VerifyReason =
  | 'missing'
  | 'malformed'
  | 'unknown-key'
  | 'not-yet-valid'
  | 'expired'
  | 'replayed'
  | 'bad-signature';

export interface SignOptions {
  /** The sender's participant id (bapId / bppId). The verifier resolves its key. */
  keyId: string;
  /** The sender's 64-hex Ed25519 private key. */
  privateKeyHex: string;
  /** Defaults to Date.now(). */
  nowMs?: number;
  /** Validity window length; default 30s. */
  ttlSeconds?: number;
  /** Override the random nonce (tests only). */
  nonce?: string;
}

export interface VerifyOptions {
  /** Resolve a keyId to its trusted 64-hex public key, or undefined if untrusted. */
  resolveKey: (keyId: string) => string | undefined;
  /** Defaults to Date.now(). */
  nowMs?: number;
  /** Tolerance for clock differences; default 5s. */
  clockSkewSeconds?: number;
  /** Single-use enforcement. Omit to skip replay checking (not recommended). */
  replayCache?: ReplayCache;
}

export type VerifyResult = { ok: true; keyId: string } | { ok: false; reason: VerifyReason };

function signingBase(
  keyId: string,
  created: number,
  expires: number,
  nonce: string,
  body: unknown,
): string {
  // Sign over exactly what crosses the wire: JSON.stringify (the transport)
  // drops undefined-valued keys, so we normalize the same way before
  // canonicalizing. Otherwise a signer holding `{publicKey: undefined}` and a
  // verifier receiving `{}` would disagree. canonicalJson stays strict (a real
  // undefined in a *grant* is still a bug); this parity lives in the message layer.
  const normalized = JSON.parse(JSON.stringify(body ?? null)) as JsonValue;
  return `${keyId}\n${created}\n${expires}\n${nonce}\n${canonicalJson(normalized)}`;
}

/** Produce the `Authorization` header value for a Beckn message body. */
export async function signMessage(body: JsonValue, opts: SignOptions): Promise<string> {
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const created = nowSec;
  const expires = nowSec + (opts.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const nonce = opts.nonce ?? randomBytes(16).toString('hex');
  const signature = await sign(
    signingBase(opts.keyId, created, expires, nonce, body),
    opts.privateKeyHex,
  );
  return (
    `Signature keyId="${opts.keyId}",algorithm="ed25519",` +
    `created="${created}",expires="${expires}",nonce="${nonce}",signature="${signature}"`
  );
}

interface ParsedHeader {
  keyId: string;
  created: number;
  expires: number;
  nonce: string;
  signature: string;
}

function parseHeader(header: string): ParsedHeader | undefined {
  if (!/^Signature\s/i.test(header)) return undefined;
  const params: Record<string, string> = {};
  for (const match of header.slice(header.indexOf(' ') + 1).matchAll(/(\w+)="([^"]*)"/g)) {
    const [, key, value] = match;
    if (key !== undefined && value !== undefined) params[key] = value;
  }
  const { keyId, created, expires, nonce, signature, algorithm } = params;
  if (!keyId || !created || !expires || !nonce || !signature) return undefined;
  if (algorithm && algorithm !== 'ed25519') return undefined;
  const createdN = Number(created);
  const expiresN = Number(expires);
  if (!Number.isFinite(createdN) || !Number.isFinite(expiresN)) return undefined;
  return { keyId, created: createdN, expires: expiresN, nonce, signature };
}

/**
 * Verify an inbound Beckn message. Order of checks matters: identity and freshness
 * before the (more expensive) signature, and replay is only recorded for an
 * otherwise-valid message so a bad signature can't burn a nonce.
 */
export async function verifyMessage(
  body: JsonValue,
  header: string | undefined,
  opts: VerifyOptions,
): Promise<VerifyResult> {
  if (!header) return { ok: false, reason: 'missing' };
  const parsed = parseHeader(header);
  if (!parsed) return { ok: false, reason: 'malformed' };

  const publicKey = opts.resolveKey(parsed.keyId);
  if (!publicKey) return { ok: false, reason: 'unknown-key' };

  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const skew = opts.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  if (parsed.created > nowSec + skew) return { ok: false, reason: 'not-yet-valid' };
  if (parsed.expires < nowSec - skew) return { ok: false, reason: 'expired' };

  const base = signingBase(parsed.keyId, parsed.created, parsed.expires, parsed.nonce, body);
  if (!(await verify(parsed.signature, base, publicKey)))
    return { ok: false, reason: 'bad-signature' };

  if (
    opts.replayCache &&
    opts.replayCache.seen(`${parsed.keyId}:${parsed.nonce}`, parsed.expires)
  ) {
    return { ok: false, reason: 'replayed' };
  }
  return { ok: true, keyId: parsed.keyId };
}

/**
 * In-memory single-use nonce store with time-based eviction. Correct for a
 * single process; a multi-instance deployment would back this with Redis keyed by
 * the same `keyId:nonce` with TTL = expiry (noted in docs/security.md).
 */
export class ReplayCache {
  private readonly seenUntil = new Map<string, number>();
  private readonly nowFn: () => number;

  constructor(nowFn: () => number = Date.now) {
    this.nowFn = nowFn;
  }

  /** Returns true if `key` was already seen; otherwise records it until `expiresSec`. */
  seen(key: string, expiresSec: number): boolean {
    this.prune();
    if (this.seenUntil.has(key)) return true;
    this.seenUntil.set(key, expiresSec * 1000);
    return false;
  }

  private prune(): void {
    const now = this.nowFn();
    for (const [key, until] of this.seenUntil) {
      if (until < now) this.seenUntil.delete(key);
    }
  }
}

/** Parse a `keyId=pubHex,keyId=pubHex` registry string into a resolver map. */
export function parseKeyRegistry(spec: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const idx = pair.indexOf('=');
    if (idx <= 0) throw new Error(`Invalid registry entry: "${pair}" (want keyId=pubkeyHex)`);
    map.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  return map;
}

/**
 * A participant's message-auth capability: sign outbound bodies as this
 * participant, and verify inbound ones against the trusted-key registry with a
 * built-in replay cache. `body` is any JSON-serializable Beckn payload.
 */
export interface ParticipantAuth {
  keyId: string;
  sign(body: unknown): Promise<string>;
  verify(body: unknown, header: string | undefined): Promise<VerifyResult>;
}

export function createParticipantAuth(opts: {
  keyId: string;
  privateKeyHex: string;
  registry: Map<string, string>;
  ttlSeconds?: number;
  clockSkewSeconds?: number;
  now?: () => number;
}): ParticipantAuth {
  const now = opts.now ?? Date.now;
  const replayCache = new ReplayCache(now);
  return {
    keyId: opts.keyId,
    sign: (body) =>
      signMessage(body as JsonValue, {
        keyId: opts.keyId,
        privateKeyHex: opts.privateKeyHex,
        ttlSeconds: opts.ttlSeconds,
        nowMs: now(),
      }),
    verify: (body, header) =>
      verifyMessage(body as JsonValue, header, {
        resolveKey: (k) => opts.registry.get(k),
        nowMs: now(),
        clockSkewSeconds: opts.clockSkewSeconds,
        replayCache,
      }),
  };
}
