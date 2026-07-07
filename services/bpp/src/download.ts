/**
 * The grant-gated download core — the security centerpiece of the BPP.
 *
 * A download only succeeds when the presented Access Grant passes BOTH halves of
 * verification (per docs/consent-artifact-spec.md §5):
 *   1. OFFLINE  — signature + temporal window + provider + resource + scope
 *                 (delegated to @bdc/beckn-schemas verifyGrant).
 *   2. ONLINE   — revocation check + maxDownloads, against injected stores.
 *
 * This module is pure/injectable: no Fastify, no DB. That's what lets the
 * expired / revoked / wrong-scope rejection tests run without a running server.
 */
import { verifyGrant, type AccessGrantClaims, type GrantScopeKind } from '@bdc/beckn-schemas';
import type { RedemptionStore, RevocationStore } from './stores/types.js';

/** A file this BPP can serve for an authorized offer. */
export interface ResolvedFile {
  path: string;
  filename: string;
  contentType: string;
}

export type FileResolver = (args: {
  resourceId: string;
  offerId: string;
  scopeKind: GrantScopeKind;
}) => ResolvedFile | undefined;

export interface RedeemParams {
  /** The presented grant (untrusted; verified here). */
  signedGrant: unknown;
  /** What the caller is asking to download. */
  requested: { resourceId: string; offerId?: string; fields?: string[] };
  /** This BPP's own subscriber id — the grant must name it as provider. */
  bppId: string;
  /** The Access Manager public key (hex) this BPP trusts. */
  accessManagerPublicKey: string;
  nowSeconds: number;
  clockSkewSeconds: number;
  revocations: RevocationStore;
  redemptions: RedemptionStore;
  resolveFile: FileResolver;
}

export type RedeemResult =
  | { ok: true; claims: AccessGrantClaims; file: ResolvedFile; redemptionCount: number }
  | { ok: false; status: number; reason: string; detail?: string };

/** Maps offline verifyGrant rejection reasons to HTTP status codes. */
const OFFLINE_STATUS: Record<string, number> = {
  malformed: 400,
  'bad-signature': 403,
  'not-yet-valid': 403,
  expired: 403,
  'wrong-provider': 403,
  'wrong-resource': 403,
  'scope-insufficient': 403,
};

export async function redeemGrant(params: RedeemParams): Promise<RedeemResult> {
  const {
    signedGrant,
    requested,
    bppId,
    accessManagerPublicKey,
    nowSeconds,
    clockSkewSeconds,
    revocations,
    redemptions,
    resolveFile,
  } = params;

  // Misconfiguration: refuse to serve if we don't know whose signatures to trust.
  if (!accessManagerPublicKey) {
    return { ok: false, status: 503, reason: 'issuer-key-unconfigured' };
  }

  // 1. OFFLINE verification.
  const offline = await verifyGrant(signedGrant, {
    issuerPublicKeyHex: accessManagerPublicKey,
    nowSeconds,
    clockSkewSeconds,
    expectedBppId: bppId,
    requested,
  });
  if (!offline.ok) {
    return {
      ok: false,
      status: OFFLINE_STATUS[offline.reason] ?? 403,
      reason: offline.reason,
      detail: offline.detail,
    };
  }
  const { claims } = offline;

  // 2a. ONLINE revocation — a signed, unexpired grant can still be revoked.
  if (await revocations.isRevoked(claims.grantId)) {
    return { ok: false, status: 403, reason: 'revoked' };
  }

  // Resolve the file BEFORE consuming a redemption slot, so a 404 doesn't burn one.
  const file = resolveFile({
    resourceId: claims.resource.resourceId,
    offerId: claims.resource.offerId,
    scopeKind: claims.scope.kind,
  });
  if (!file) {
    return { ok: false, status: 404, reason: 'resource-unavailable' };
  }

  // 2b. maxDownloads — atomically reserve a slot; reject if over the cap.
  const redemptionCount = await redemptions.recordRedemption(claims.grantId);
  const cap = claims.scope.maxDownloads;
  if (cap !== undefined && redemptionCount > cap) {
    return { ok: false, status: 403, reason: 'download-limit-exceeded' };
  }

  return { ok: true, claims, file, redemptionCount };
}

/**
 * Parse a presented grant from an `Authorization: Grant <base64url(json)>` header.
 * Returns the decoded JSON (untrusted) or undefined if the header is absent/malformed.
 */
export function parsePresentedGrant(authorizationHeader: string | undefined): unknown {
  if (!authorizationHeader) return undefined;
  const match = /^Grant\s+([A-Za-z0-9_-]+={0,2})$/.exec(authorizationHeader.trim());
  if (!match) return undefined;
  try {
    const json = Buffer.from(match[1]!, 'base64url').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** Encode a signed grant for presentation in the Authorization header. */
export function encodePresentedGrant(signedGrant: unknown): string {
  return `Grant ${Buffer.from(JSON.stringify(signedGrant), 'utf-8').toString('base64url')}`;
}
