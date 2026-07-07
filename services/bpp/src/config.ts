/**
 * BPP configuration — one codebase, many instances. Each provider instance is
 * configured entirely by environment: its Beckn identity, which seed catalog it
 * serves, and the Access Manager public key it trusts to sign grants.
 */
import { resolve } from 'node:path';

export interface BppConfig {
  serviceName: string;
  port: number;
  host: string;
  /** Beckn subscriber id of this provider platform. */
  bppId: string;
  /** Public base URL of this provider. */
  bppUri: string;
  /** Absolute path to the seed catalog JSON this instance serves. */
  catalogFile: string;
  /** Directory holding the downloadable data files for this catalog. */
  dataDir: string;
  /**
   * Ed25519 public key (hex) of the Access Manager whose grants this BPP honors.
   * Empty until Phase 4 wiring; the download endpoint refuses to serve if unset.
   */
  accessManagerPublicKey: string;
  /** Postgres connection string; when absent, in-memory stores are used. */
  databaseUrl: string | undefined;
  /** Clock-skew tolerance (seconds) for grant temporal checks. */
  clockSkewSeconds: number;
}

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BppConfig {
  const port = Number(env.PORT ?? 3002);
  const bppId = requireEnv('BPP_ID', 'bpp.tabular.local');
  const catalogFile = resolve(
    requireEnv('CATALOG_FILE', 'seed-data/catalogs/tabular.catalog.json'),
  );
  return {
    serviceName: `bpp:${bppId}`,
    port,
    host: env.HOST ?? '0.0.0.0',
    bppId,
    bppUri: requireEnv('BPP_URI', `http://localhost:${port}`),
    catalogFile,
    dataDir: resolve(env.DATA_DIR ?? 'seed-data/files'),
    accessManagerPublicKey: env.ACCESS_MANAGER_PUBLIC_KEY ?? '',
    databaseUrl: env.DATABASE_URL || undefined,
    clockSkewSeconds: Number(env.CLOCK_SKEW_SECONDS ?? 30),
  };
}
