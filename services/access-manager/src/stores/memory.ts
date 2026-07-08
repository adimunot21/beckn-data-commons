/** In-memory GrantStore for tests and DB-less dev. */
import type { GrantRecord, GrantStore, RevokeOutcome } from './types.js';

export class InMemoryGrantStore implements GrantStore {
  private readonly grants = new Map<string, GrantRecord>();

  async save(record: GrantRecord): Promise<void> {
    this.grants.set(record.grantId, { ...record });
  }

  async get(grantId: string): Promise<GrantRecord | undefined> {
    const r = this.grants.get(grantId);
    return r ? { ...r } : undefined;
  }

  async listByGrantee(granteeId: string): Promise<GrantRecord[]> {
    return [...this.grants.values()]
      .filter((r) => r.granteeId === granteeId)
      .sort((a, b) => b.issuedAt - a.issuedAt)
      .map((r) => ({ ...r }));
  }

  async revoke(grantId: string, _reason: string): Promise<RevokeOutcome> {
    const r = this.grants.get(grantId);
    if (!r) return 'not-found';
    if (r.status === 'REVOKED') return 'already-revoked';
    r.status = 'REVOKED';
    return 'revoked';
  }

  async markExpired(nowSeconds: number): Promise<number> {
    let n = 0;
    for (const r of this.grants.values()) {
      if (r.status === 'ISSUED' && r.expiresAt < nowSeconds) {
        r.status = 'EXPIRED';
        n++;
      }
    }
    return n;
  }
}
