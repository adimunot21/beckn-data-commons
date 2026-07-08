/**
 * Access Manager entrypoint. Derives its public key from AM_PRIVATE_KEY, selects
 * Postgres or in-memory storage, starts an expiry-sweep interval, and serves.
 */
import pg from 'pg';
import { publicKeyFor } from '@bdc/crypto-utils';
import { loadConfig } from './config.js';
import { GrantService } from './service.js';
import { createApp } from './app.js';
import { InMemoryGrantStore } from './stores/memory.js';
import { PostgresGrantStore, initSchema } from './stores/postgres.js';
import type { GrantStore } from './stores/types.js';

const { Pool } = pg;
const SWEEP_INTERVAL_MS = 60_000;

async function main(): Promise<void> {
  const config = loadConfig();
  const publicKey = await publicKeyFor(config.privateKey);

  let store: GrantStore;
  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl });
    await initSchema(pool);
    store = new PostgresGrantStore(pool);
  } else {
    store = new InMemoryGrantStore();
  }

  const service = new GrantService({
    amId: config.amId,
    issuerKeyId: config.issuerKeyId,
    privateKey: config.privateKey,
    publicKey,
    ttlSeconds: config.grantTtlSeconds,
    store,
  });

  const app = createApp({ config, service });

  const sweep = setInterval(() => {
    void service
      .sweepExpired(Math.floor(Date.now() / 1000))
      .then((n) => n > 0 && app.log.info({ expired: n }, 'expiry sweep'))
      .catch((err) => app.log.error({ err }, 'expiry sweep failed'));
  }, SWEEP_INTERVAL_MS);
  sweep.unref();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      { amId: config.amId, publicKey, store: config.databaseUrl ? 'postgres' : 'memory' },
      'Access Manager up',
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
