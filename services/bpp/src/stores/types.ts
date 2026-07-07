/**
 * Store abstractions the download endpoint depends on. Two implementations:
 * in-memory (tests, dev) and Postgres/drizzle (running service). Injecting these
 * keeps the grant-verification logic pure and hermetically testable — no DB
 * needed to prove expired/revoked/wrong-scope rejection.
 */

/**
 * The online half of grant verification: has a grant been revoked? Written by the
 * Access Manager (Phase 4), read by the BPP at every redeem.
 */
export interface RevocationStore {
  isRevoked(grantId: string): Promise<boolean>;
  /** Present so tests (and later the AM's shared store) can revoke. */
  revoke(grantId: string, reason?: string): Promise<void>;
}

/**
 * Tracks how many times a grant has been redeemed, to enforce scope.maxDownloads.
 * `recordRedemption` must be atomic w.r.t. the returned count so concurrent
 * downloads can't both slip past the cap.
 */
export interface RedemptionStore {
  /** Atomically increment and return the new redemption count for a grant. */
  recordRedemption(grantId: string): Promise<number>;
  getCount(grantId: string): Promise<number>;
}
