/**
 * GrantService — the Access Manager's core logic: mint + sign + persist grants,
 * revoke them (writing the shared revocation table), and list/sweep. Pure w.r.t.
 * I/O: crypto and persistence are injected, so it is fully unit-testable.
 */
import { randomUUID } from 'node:crypto';
import {
  AccessGrantClaims,
  issueGrant,
  type IssueGrantRequest,
  type SignedAccessGrant,
} from '@bdc/beckn-schemas';
import type { GrantRecord, GrantStore, RevokeOutcome } from './stores/types.js';

export interface GrantServiceDeps {
  amId: string;
  issuerKeyId: string;
  /** Ed25519 private key (hex) used to sign grants. */
  privateKey: string;
  /** Corresponding public key (hex) — exposed at /pubkey. */
  publicKey: string;
  /** Default grant lifetime (seconds). */
  ttlSeconds: number;
  store: GrantStore;
}

export class GrantService {
  constructor(private readonly deps: GrantServiceDeps) {}

  get publicKey(): string {
    return this.deps.publicKey;
  }

  /** Mint, sign, and persist a grant. `nowSeconds` is injected for determinism. */
  async issue(req: IssueGrantRequest, nowSeconds: number): Promise<SignedAccessGrant> {
    const ttl = req.ttlSeconds ?? this.deps.ttlSeconds;
    const claims = AccessGrantClaims.parse({
      v: 'bdc-grant/1',
      grantId: randomUUID(),
      issuer: this.deps.amId,
      issuerKeyId: this.deps.issuerKeyId,
      grantee: req.grantee,
      provider: req.provider,
      resource: req.resource,
      scope: req.scope,
      licenseClass: req.licenseClass,
      purpose: req.purpose,
      transactionId: req.transactionId,
      issuedAt: nowSeconds,
      notBefore: nowSeconds,
      expiresAt: nowSeconds + ttl,
      revocable: true,
      nonce: randomUUID(),
    });

    const signed = await issueGrant(claims, this.deps.privateKey);

    const record: GrantRecord = {
      grantId: claims.grantId,
      granteeId: claims.grantee.id,
      bppId: claims.provider.bppId,
      resourceId: claims.resource.resourceId,
      offerId: claims.resource.offerId,
      scope: claims.scope,
      licenseClass: claims.licenseClass,
      purpose: claims.purpose,
      transactionId: claims.transactionId,
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
      status: 'ISSUED',
      signedGrant: signed,
    };
    await this.deps.store.save(record);
    return signed;
  }

  async get(grantId: string): Promise<GrantRecord | undefined> {
    return this.deps.store.get(grantId);
  }

  async list(granteeId: string): Promise<GrantRecord[]> {
    return this.deps.store.listByGrantee(granteeId);
  }

  async revoke(grantId: string, reason: string): Promise<RevokeOutcome> {
    return this.deps.store.revoke(grantId, reason);
  }

  async sweepExpired(nowSeconds: number): Promise<number> {
    return this.deps.store.markExpired(nowSeconds);
  }
}
