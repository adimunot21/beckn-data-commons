/**
 * In-memory Store implementations for tests and DB-less dev. Single-process only;
 * the Postgres implementations (./postgres.ts) are used by the running service.
 */
import type { RedemptionStore, RevocationStore } from './types.js';

export class InMemoryRevocationStore implements RevocationStore {
  private readonly revoked = new Map<string, string>();

  async isRevoked(grantId: string): Promise<boolean> {
    return this.revoked.has(grantId);
  }

  async revoke(grantId: string, reason = 'unspecified'): Promise<void> {
    this.revoked.set(grantId, reason);
  }
}

export class InMemoryRedemptionStore implements RedemptionStore {
  private readonly counts = new Map<string, number>();

  async recordRedemption(grantId: string): Promise<number> {
    const next = (this.counts.get(grantId) ?? 0) + 1;
    this.counts.set(grantId, next);
    return next;
  }

  async getCount(grantId: string): Promise<number> {
    return this.counts.get(grantId) ?? 0;
  }
}
