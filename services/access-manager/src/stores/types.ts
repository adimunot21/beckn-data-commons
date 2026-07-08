/**
 * Grant persistence for the Access Manager. Implementations: in-memory (tests)
 * and Postgres (running service). The Postgres impl writes revocations to the
 * SAME `grant_revocations` table the BPP reads — that shared table is how the
 * online revocation check works across services.
 */
import type { GrantScope, LicenseClass, SignedAccessGrant } from '@bdc/beckn-schemas';

export type GrantStatus = 'ISSUED' | 'REVOKED' | 'EXPIRED';

/** What the AM tracks about each issued grant (its ledger row). */
export interface GrantRecord {
  grantId: string;
  granteeId: string;
  bppId: string;
  resourceId: string;
  offerId: string;
  scope: GrantScope;
  licenseClass: LicenseClass;
  purpose: string;
  transactionId: string;
  issuedAt: number;
  expiresAt: number;
  status: GrantStatus;
  signedGrant: SignedAccessGrant;
}

export type RevokeOutcome = 'revoked' | 'not-found' | 'already-revoked';

export interface GrantStore {
  save(record: GrantRecord): Promise<void>;
  get(grantId: string): Promise<GrantRecord | undefined>;
  listByGrantee(granteeId: string): Promise<GrantRecord[]>;
  /** Mark revoked in the ledger AND write to the shared revocation table. */
  revoke(grantId: string, reason: string): Promise<RevokeOutcome>;
  /** Housekeeping: mark ISSUED grants past their expiry as EXPIRED. Returns count. */
  markExpired(nowSeconds: number): Promise<number>;
}
