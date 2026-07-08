/**
 * Postgres GrantStore. The `grant_revocations` table is shared with the BPP
 * (which reads it for the online revocation check); the same advisory-lock key
 * is used across services so concurrent schema init doesn't race.
 */
import type { Pool } from 'pg';
import type { GrantScope, LicenseClass, SignedAccessGrant } from '@bdc/beckn-schemas';
import type { GrantRecord, GrantStatus, GrantStore, RevokeOutcome } from './types.js';

/** Must match the BPP's key — the shared table is created under the same lock. */
const SCHEMA_LOCK_KEY = 728491;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS grants (
  grant_id       TEXT PRIMARY KEY,
  grantee_id     TEXT NOT NULL,
  bpp_id         TEXT NOT NULL,
  resource_id    TEXT NOT NULL,
  offer_id       TEXT NOT NULL,
  scope          JSONB NOT NULL,
  license_class  TEXT NOT NULL,
  purpose        TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  issued_at      BIGINT NOT NULL,
  expires_at     BIGINT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ISSUED',
  signed_grant   JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grants_grantee_idx ON grants (grantee_id);
CREATE TABLE IF NOT EXISTS grant_revocations (
  grant_id   TEXT PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason     TEXT
);
`;

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

interface GrantRow {
  grant_id: string;
  grantee_id: string;
  bpp_id: string;
  resource_id: string;
  offer_id: string;
  scope: GrantScope;
  license_class: LicenseClass;
  purpose: string;
  transaction_id: string;
  issued_at: string; // BIGINT comes back as string
  expires_at: string;
  status: GrantStatus;
  signed_grant: SignedAccessGrant;
}

function toRecord(row: GrantRow): GrantRecord {
  return {
    grantId: row.grant_id,
    granteeId: row.grantee_id,
    bppId: row.bpp_id,
    resourceId: row.resource_id,
    offerId: row.offer_id,
    scope: row.scope,
    licenseClass: row.license_class,
    purpose: row.purpose,
    transactionId: row.transaction_id,
    issuedAt: Number(row.issued_at),
    expiresAt: Number(row.expires_at),
    status: row.status,
    signedGrant: row.signed_grant,
  };
}

export class PostgresGrantStore implements GrantStore {
  constructor(private readonly pool: Pool) {}

  async save(r: GrantRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO grants (grant_id, grantee_id, bpp_id, resource_id, offer_id, scope,
         license_class, purpose, transaction_id, issued_at, expires_at, status, signed_grant)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (grant_id) DO NOTHING`,
      [
        r.grantId,
        r.granteeId,
        r.bppId,
        r.resourceId,
        r.offerId,
        r.scope,
        r.licenseClass,
        r.purpose,
        r.transactionId,
        r.issuedAt,
        r.expiresAt,
        r.status,
        r.signedGrant,
      ],
    );
  }

  async get(grantId: string): Promise<GrantRecord | undefined> {
    const { rows } = await this.pool.query<GrantRow>('SELECT * FROM grants WHERE grant_id = $1', [
      grantId,
    ]);
    return rows[0] ? toRecord(rows[0]) : undefined;
  }

  async listByGrantee(granteeId: string): Promise<GrantRecord[]> {
    const { rows } = await this.pool.query<GrantRow>(
      'SELECT * FROM grants WHERE grantee_id = $1 ORDER BY issued_at DESC',
      [granteeId],
    );
    return rows.map(toRecord);
  }

  async revoke(grantId: string, reason: string): Promise<RevokeOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ status: GrantStatus }>(
        'SELECT status FROM grants WHERE grant_id = $1 FOR UPDATE',
        [grantId],
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return 'not-found';
      }
      if (rows[0]!.status === 'REVOKED') {
        await client.query('ROLLBACK');
        return 'already-revoked';
      }
      await client.query("UPDATE grants SET status = 'REVOKED' WHERE grant_id = $1", [grantId]);
      await client.query(
        `INSERT INTO grant_revocations (grant_id, reason) VALUES ($1, $2)
         ON CONFLICT (grant_id) DO NOTHING`,
        [grantId, reason],
      );
      await client.query('COMMIT');
      return 'revoked';
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async markExpired(nowSeconds: number): Promise<number> {
    const res = await this.pool.query(
      "UPDATE grants SET status = 'EXPIRED' WHERE status = 'ISSUED' AND expires_at < $1",
      [nowSeconds],
    );
    return res.rowCount ?? 0;
  }
}
