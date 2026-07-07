/**
 * The Access Grant — BDC's consent artifact and the project's novel contribution.
 *
 * A DEPA-inspired, Ed25519-signed, scoped, purpose-bound, expiring, REVOCABLE
 * credential issued by the Access Manager (separate from the data-holding BPP)
 * that gates the actual download. It replaces DDM's bare `fulfillment:accessUrl`
 * bearer model (single-party, symmetric, non-revocable) — see
 * docs/consent-artifact-spec.md.
 *
 * Verification is deliberately split:
 *   - OFFLINE (here): signature over canonical claims + temporal window + scope.
 *     Anyone holding the issuer's public key can verify without calling back.
 *   - ONLINE (caller's responsibility): revocation status against a shared store.
 *     A signed grant cannot know it was revoked; expiry bounds the exposure,
 *     the revocation check makes it immediate. `verifyGrant` returns
 *     `requiresRevocationCheck` so the download endpoint cannot forget this step.
 */
import { z } from 'zod';
import { canonicalJson, verifyCanonical, signCanonical, type JsonValue } from '@bdc/crypto-utils';
import { LicenseClass } from './domain.js';

/** How much of the resource the grant authorizes. */
export const GrantScopeKind = z.enum(['full', 'sample', 'subset']);
export type GrantScopeKind = z.infer<typeof GrantScopeKind>;

export const GrantScope = z
  .object({
    kind: GrantScopeKind,
    /** For `subset`: the specific fields/columns authorized. */
    fields: z.array(z.string()).min(1).optional(),
    /** Optional cap on redemptions (enforced with the online revocation store). */
    maxDownloads: z.number().int().positive().optional(),
  })
  .strict()
  .refine((s) => (s.kind === 'subset' ? Array.isArray(s.fields) && s.fields.length > 0 : true), {
    message: "scope.kind 'subset' requires a non-empty fields array",
  });
export type GrantScope = z.infer<typeof GrantScope>;

/**
 * The signed claims. Timestamps are unix seconds (UTC) for unambiguous
 * comparison. `nonce` gives every grant a unique body even with identical claims.
 */
export const AccessGrantClaims = z
  .object({
    /** Artifact format version. */
    v: z.literal('bdc-grant/1'),
    /** Unique grant id (also the revocation-store key). */
    grantId: z.string().uuid(),
    /** Access Manager identity that issued this grant. */
    issuer: z.string().min(1),
    /** Key id that signed it: `subscriberId|uniqueKeyId|ed25519`. */
    issuerKeyId: z.string().min(1),
    /** Who may redeem it. */
    grantee: z.object({ id: z.string().min(1), publicKey: z.string().optional() }).strict(),
    /** The data holder that must honor it. */
    provider: z.object({ bppId: z.string().min(1), bppUri: z.string().url() }).strict(),
    /** What it authorizes access to. */
    resource: z.object({ resourceId: z.string().min(1), offerId: z.string().min(1) }).strict(),
    scope: GrantScope,
    /** Normalized license class the grant is issued under. */
    licenseClass: LicenseClass,
    /** Human-stated purpose of access (DEPA "purpose"). */
    purpose: z.string().min(1),
    /** Links the grant to the Beckn journey that produced it. */
    transactionId: z.string().uuid(),
    issuedAt: z.number().int().nonnegative(),
    notBefore: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
    /** Whether the issuer may later revoke it (always checked online regardless). */
    revocable: z.boolean(),
    /** Per-grant uniqueness / replay defense. */
    nonce: z.string().min(1),
  })
  .strict()
  .refine((c) => c.notBefore <= c.expiresAt, {
    message: 'notBefore must be <= expiresAt',
  });
export type AccessGrantClaims = z.infer<typeof AccessGrantClaims>;

/** A grant on the wire: claims + detached Ed25519 signature over their canonical JSON. */
export const SignedAccessGrant = z
  .object({
    claims: AccessGrantClaims,
    alg: z.literal('ed25519'),
    signature: z.string().regex(/^[0-9a-f]{128}$/, 'signature must be 128 hex chars'),
  })
  .strict();
export type SignedAccessGrant = z.infer<typeof SignedAccessGrant>;

/** The exact bytes that get signed — exported so issuer and verifier never drift. */
export function grantSigningPayload(claims: AccessGrantClaims): string {
  return canonicalJson(claims as unknown as JsonValue);
}

/**
 * Issue a signed grant. `claims` must already be valid; we parse to fail loudly
 * on a malformed grant rather than sign garbage.
 */
export async function issueGrant(
  claims: AccessGrantClaims,
  issuerPrivateKeyHex: string,
): Promise<SignedAccessGrant> {
  const valid = AccessGrantClaims.parse(claims);
  const signature = await signCanonical(valid as unknown as JsonValue, issuerPrivateKeyHex);
  return { claims: valid, alg: 'ed25519', signature };
}

/** Structured, non-throwing result of offline grant verification. */
export type GrantVerification =
  | { ok: false; reason: GrantRejectionReason; detail?: string }
  | { ok: true; claims: AccessGrantClaims; requiresRevocationCheck: true };

export type GrantRejectionReason =
  | 'malformed'
  | 'bad-signature'
  | 'not-yet-valid'
  | 'expired'
  | 'wrong-provider'
  | 'wrong-resource'
  | 'scope-insufficient';

export interface VerifyGrantOptions {
  /** Issuer's Ed25519 public key (hex) to check the signature against. */
  issuerPublicKeyHex: string;
  /** Current time in unix seconds (inject for testability). */
  nowSeconds: number;
  /** If set, the grant's provider.bppId must match (the checking BPP's own id). */
  expectedBppId?: string;
  /** If set, the requested resourceId/offerId must match the grant. */
  requested?: { resourceId: string; offerId?: string; fields?: string[] };
  /** Clock-skew tolerance in seconds for the temporal window (default 30s). */
  clockSkewSeconds?: number;
}

/**
 * OFFLINE verification: signature + temporal window + provider/resource/scope.
 * On success returns `requiresRevocationCheck: true` — the caller MUST still
 * check the revocation store online before serving bytes. Never throws.
 */
export async function verifyGrant(
  signed: unknown,
  opts: VerifyGrantOptions,
): Promise<GrantVerification> {
  const parsed = SignedAccessGrant.safeParse(signed);
  if (!parsed.success) {
    return { ok: false, reason: 'malformed', detail: parsed.error.message };
  }
  const { claims, signature } = parsed.data;

  const sigOk = await verifyCanonical(
    signature,
    claims as unknown as JsonValue,
    opts.issuerPublicKeyHex,
  );
  if (!sigOk) return { ok: false, reason: 'bad-signature' };

  const skew = opts.clockSkewSeconds ?? 30;
  if (opts.nowSeconds + skew < claims.notBefore) {
    return { ok: false, reason: 'not-yet-valid' };
  }
  if (opts.nowSeconds - skew > claims.expiresAt) {
    return { ok: false, reason: 'expired' };
  }

  if (opts.expectedBppId && claims.provider.bppId !== opts.expectedBppId) {
    return { ok: false, reason: 'wrong-provider' };
  }

  if (opts.requested) {
    if (claims.resource.resourceId !== opts.requested.resourceId) {
      return { ok: false, reason: 'wrong-resource' };
    }
    if (opts.requested.offerId && claims.resource.offerId !== opts.requested.offerId) {
      return { ok: false, reason: 'wrong-resource' };
    }
    // Scope enforcement: a 'subset' grant only authorizes its listed fields.
    if (claims.scope.kind === 'subset' && opts.requested.fields) {
      const allowed = new Set(claims.scope.fields ?? []);
      const overreach = opts.requested.fields.filter((f) => !allowed.has(f));
      if (overreach.length > 0) {
        return {
          ok: false,
          reason: 'scope-insufficient',
          detail: `unauthorized fields: ${overreach.join(', ')}`,
        };
      }
    }
  }

  return { ok: true, claims, requiresRevocationCheck: true };
}
