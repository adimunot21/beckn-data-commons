/**
 * BPP entrypoint — a config-driven Beckn provider platform. One codebase, run
 * as many instances as there are catalogs (see infra/docker-compose.yml).
 *
 * Selects Postgres-backed stores when DATABASE_URL is set, else in-memory.
 */
import pg from 'pg';
import { createParticipantAuth, parseKeyRegistry } from '@bdc/crypto-utils';
import { loadConfig } from './config.js';
import { BppCatalog } from './catalog.js';
import { createApp } from './app.js';
import { InMemoryRedemptionStore, InMemoryRevocationStore } from './stores/memory.js';
import { PostgresRedemptionStore, PostgresRevocationStore, initSchema } from './stores/postgres.js';
import type { RedemptionStore, RevocationStore } from './stores/types.js';

const { Pool } = pg;

/** Mandatory per-hop message auth; the BPP refuses to boot without it. */
function requireAuth(keyId: string, clockSkewSeconds: number) {
  const privateKeyHex = process.env.BECKN_PRIVATE_KEY;
  const registrySpec = process.env.BECKN_REGISTRY;
  if (!privateKeyHex || !registrySpec) {
    throw new Error(
      'BECKN_PRIVATE_KEY and BECKN_REGISTRY are required — per-hop message auth is mandatory',
    );
  }
  return createParticipantAuth({
    keyId,
    privateKeyHex,
    registry: parseKeyRegistry(registrySpec),
    ttlSeconds: 30,
    clockSkewSeconds,
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const auth = requireAuth(config.bppId, config.clockSkewSeconds);
  const catalog = BppCatalog.load(config.catalogFile, config.dataDir);

  let revocations: RevocationStore;
  let redemptions: RedemptionStore;
  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl });
    await initSchema(pool);
    revocations = new PostgresRevocationStore(pool);
    redemptions = new PostgresRedemptionStore(pool);
  } else {
    revocations = new InMemoryRevocationStore();
    redemptions = new InMemoryRedemptionStore();
  }

  const app = createApp({
    config,
    catalog,
    revocations,
    redemptions,
    verifyRequest: auth.verify,
    signCallback: auth.sign,
  });

  if (!config.accessManagerPublicKey) {
    app.log.warn(
      'ACCESS_MANAGER_PUBLIC_KEY is not set — the download endpoint will refuse to serve until it is (Phase 4 wiring).',
    );
  }

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      {
        bppId: config.bppId,
        catalog: config.catalogFile,
        store: config.databaseUrl ? 'postgres' : 'memory',
      },
      'BPP up',
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
