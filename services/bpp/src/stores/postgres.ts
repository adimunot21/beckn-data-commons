/**
 * Postgres-backed Store implementations for the running BPP.
 *
 * Uses parameterized SQL via node-postgres — right-sized for two small tables.
 * `recordRedemption` is a single atomic upsert-returning so concurrent downloads
 * cannot both slip past a maxDownloads cap. The revocation table is the shared
 * store the Access Manager writes to in Phase 4; the BPP only reads it here.
 */
import type { Pool } from 'pg';
import type { RedemptionStore, RevocationStore } from './types.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS grant_revocations (
  grant_id   TEXT PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason     TEXT
);
CREATE TABLE IF NOT EXISTS bpp_grant_redemptions (
  grant_id         TEXT PRIMARY KEY,
  downloads_used   INTEGER NOT NULL DEFAULT 0,
  first_redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/** Fixed key so all BPP instances take the same advisory lock during schema init. */
const SCHEMA_LOCK_KEY = 728491;

/**
 * Create the tables, serialized across instances with a Postgres advisory lock.
 * Without it, multiple BPPs booting at once race on `CREATE TABLE IF NOT EXISTS`
 * and one hits a `pg_type` unique-violation (the check isn't atomic vs. concurrent
 * creators).
 */
export async function initSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_KEY]);
    await client.query(SCHEMA_SQL);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

export class PostgresRevocationStore implements RevocationStore {
  constructor(private readonly pool: Pool) {}

  async isRevoked(grantId: string): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT 1 FROM grant_revocations WHERE grant_id = $1', [
      grantId,
    ]);
    return rows.length > 0;
  }

  async revoke(grantId: string, reason = 'unspecified'): Promise<void> {
    await this.pool.query(
      `INSERT INTO grant_revocations (grant_id, reason) VALUES ($1, $2)
       ON CONFLICT (grant_id) DO NOTHING`,
      [grantId, reason],
    );
  }
}

export class PostgresRedemptionStore implements RedemptionStore {
  constructor(private readonly pool: Pool) {}

  async recordRedemption(grantId: string): Promise<number> {
    const { rows } = await this.pool.query<{ downloads_used: number }>(
      `INSERT INTO bpp_grant_redemptions (grant_id, downloads_used) VALUES ($1, 1)
       ON CONFLICT (grant_id) DO UPDATE
         SET downloads_used = bpp_grant_redemptions.downloads_used + 1,
             last_redeemed_at = now()
       RETURNING downloads_used`,
      [grantId],
    );
    return rows[0]!.downloads_used;
  }

  async getCount(grantId: string): Promise<number> {
    const { rows } = await this.pool.query<{ downloads_used: number }>(
      'SELECT downloads_used FROM bpp_grant_redemptions WHERE grant_id = $1',
      [grantId],
    );
    return rows[0]?.downloads_used ?? 0;
  }
}
