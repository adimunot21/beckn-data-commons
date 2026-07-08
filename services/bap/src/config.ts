/**
 * BAP configuration. The BAP is the consumer gateway: it fans `discover` out to
 * the known BPPs, aggregates their async `on_discover` callbacks, orchestrates
 * select/init/confirm, and calls the Access Manager to issue a grant at confirm.
 */
export interface BppEndpoint {
  bppId: string;
  uri: string;
}

export interface BapConfig {
  serviceName: string;
  port: number;
  host: string;
  bapId: string;
  /** Public base URL where BPP callbacks (on_*) are received. */
  bapUri: string;
  networkId: string;
  /** Known providers to fan out to. */
  bpps: BppEndpoint[];
  accessManagerUrl: string;
  /** How long to collect on_discover callbacks before returning results. */
  aggregationWindowMs: number;
  /** ttl set on outbound Beckn messages (ISO-8601 duration). */
  messageTtl: string;
}

function requireEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Parse "bppId=uri,bppId=uri" into endpoints. */
export function parseBpps(spec: string): BppEndpoint[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [bppId, uri] = pair.split('=');
      if (!bppId || !uri)
        throw new Error(`Invalid BPP_ENDPOINTS entry: "${pair}" (want bppId=uri)`);
      return { bppId: bppId.trim(), uri: uri.trim().replace(/\/$/, '') };
    });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BapConfig {
  const port = Number(env.PORT ?? 3001);
  return {
    serviceName: 'bap',
    port,
    host: env.HOST ?? '0.0.0.0',
    bapId: env.BAP_ID ?? 'bap.bdc.local',
    bapUri: requireEnv('BAP_URI', `http://localhost:${port}`),
    networkId: env.NETWORK_ID ?? 'nfh.global/testnet-ddm',
    bpps: parseBpps(
      env.BPP_ENDPOINTS ??
        'bpp.tabular.local=http://localhost:3002,bpp.vision.local=http://localhost:3012,bpp.models.local=http://localhost:3022',
    ),
    accessManagerUrl: (env.ACCESS_MANAGER_URL ?? 'http://localhost:3003').replace(/\/$/, ''),
    aggregationWindowMs: Number(env.AGGREGATION_WINDOW_MS ?? 3000),
    messageTtl: env.MESSAGE_TTL ?? 'PT30S',
  };
}
