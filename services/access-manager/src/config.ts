/**
 * Access Manager configuration. The AM is the consent authority: it holds the
 * signing key that BPPs trust and issues/revokes Access Grants.
 */
export interface AmConfig {
  serviceName: string;
  port: number;
  host: string;
  /** AM identity (grant `issuer`). */
  amId: string;
  /** Key id embedded in grants: `subscriberId|uniqueKeyId|algorithm`. */
  issuerKeyId: string;
  /** Ed25519 private key (hex). Required — the AM cannot issue without it. */
  privateKey: string;
  /** Default grant lifetime in seconds. */
  grantTtlSeconds: number;
  databaseUrl: string | undefined;
}

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AmConfig {
  const port = Number(env.PORT ?? 3003);
  const amId = env.AM_ID ?? 'access-manager.bdc.local';
  return {
    serviceName: `access-manager:${amId}`,
    port,
    host: env.HOST ?? '0.0.0.0',
    amId,
    issuerKeyId: env.AM_KEY_ID ?? `${amId}|key-1|ed25519`,
    privateKey: requireEnv('AM_PRIVATE_KEY'),
    grantTtlSeconds: Number(env.GRANT_TTL_SECONDS ?? 3600),
    databaseUrl: env.DATABASE_URL || undefined,
  };
}
