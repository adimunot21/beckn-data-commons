/**
 * Ed25519 signing/verification for Beckn Data Commons.
 *
 * Uses @noble/ed25519 v2's async API (no global SHA-512 wiring needed). Keys and
 * signatures are handled as lowercase hex strings so they embed cleanly in JSON
 * (grants, message headers) and in Postgres text columns.
 *
 * The higher-level *canonical* helpers sign over `canonicalJson(payload)` so an
 * issuer's signature is reproducible by any verifier regardless of key order.
 * This is the crypto the Access Grant (consent artifact) is built on.
 *
 * NOTE: this is generic Ed25519, used first for our own Access Grant format.
 * The Beckn message `Authorization`-header signature scheme (digest inputs, header
 * grammar) must be verified against a real signed Fabric request before we
 * implement it in Phase 3 — do not assume it here.
 */
import { getPublicKeyAsync, signAsync, verifyAsync, utils, etc } from '@noble/ed25519';
import { canonicalJson, type JsonValue } from './canonical.js';

/** A hex-encoded Ed25519 keypair (32-byte private, 32-byte public). */
export interface KeyPair {
  /** 64 hex chars (32 bytes). */
  privateKey: string;
  /** 64 hex chars (32 bytes). */
  publicKey: string;
}

const PRIVATE_KEY_BYTES = 32;
const PUBLIC_KEY_BYTES = 32;
const SIGNATURE_BYTES = 64;

const HEX_RE = /^[0-9a-fA-F]*$/;

function assertHex(value: string, expectedBytes: number, label: string): Uint8Array {
  if (typeof value !== 'string' || !HEX_RE.test(value) || value.length !== expectedBytes * 2) {
    throw new TypeError(
      `${label} must be a ${expectedBytes * 2}-char hex string (${expectedBytes} bytes), got ${
        typeof value === 'string' ? `${value.length} chars` : typeof value
      }`,
    );
  }
  return etc.hexToBytes(value.toLowerCase());
}

/** Generate a fresh Ed25519 keypair as hex strings. */
export async function generateKeyPair(): Promise<KeyPair> {
  const privBytes = utils.randomPrivateKey();
  const pubBytes = await getPublicKeyAsync(privBytes);
  return {
    privateKey: etc.bytesToHex(privBytes),
    publicKey: etc.bytesToHex(pubBytes),
  };
}

/** Derive the hex public key for a hex private key. */
export async function publicKeyFor(privateKeyHex: string): Promise<string> {
  const priv = assertHex(privateKeyHex, PRIVATE_KEY_BYTES, 'privateKey');
  return etc.bytesToHex(await getPublicKeyAsync(priv));
}

/**
 * Sign the UTF-8 bytes of `message` with a hex private key. Returns a hex
 * signature (128 hex chars / 64 bytes).
 */
export async function sign(message: string, privateKeyHex: string): Promise<string> {
  const priv = assertHex(privateKeyHex, PRIVATE_KEY_BYTES, 'privateKey');
  const msgBytes = new TextEncoder().encode(message);
  const sig = await signAsync(msgBytes, priv);
  return etc.bytesToHex(sig);
}

/**
 * Verify a hex signature over the UTF-8 bytes of `message` against a hex public
 * key. Returns false (never throws) on malformed signature/key inputs so callers
 * can treat "invalid" and "malformed" uniformly at a trust boundary.
 */
export async function verify(
  signatureHex: string,
  message: string,
  publicKeyHex: string,
): Promise<boolean> {
  let sig: Uint8Array;
  let pub: Uint8Array;
  try {
    sig = assertHex(signatureHex, SIGNATURE_BYTES, 'signature');
    pub = assertHex(publicKeyHex, PUBLIC_KEY_BYTES, 'publicKey');
  } catch {
    return false;
  }
  const msgBytes = new TextEncoder().encode(message);
  try {
    return await verifyAsync(sig, msgBytes, pub);
  } catch {
    return false;
  }
}

/** Sign the canonical JSON of `payload`. */
export async function signCanonical(payload: JsonValue, privateKeyHex: string): Promise<string> {
  return sign(canonicalJson(payload), privateKeyHex);
}

/** Verify a signature over the canonical JSON of `payload`. */
export async function verifyCanonical(
  signatureHex: string,
  payload: JsonValue,
  publicKeyHex: string,
): Promise<boolean> {
  let canonical: string;
  try {
    canonical = canonicalJson(payload);
  } catch {
    return false;
  }
  return verify(signatureHex, canonical, publicKeyHex);
}
