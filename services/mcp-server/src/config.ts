/**
 * MCP server configuration. This process is a host-run stdio bridge launched by
 * the MCP client (Claude); it talks to the BDC backend over localhost.
 */
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export interface McpConfig {
  bapUrl: string;
  amUrl: string;
  /** Identity all grants are issued to for this agent session. */
  granteeId: string;
  /** Where downloaded datasets are written. */
  downloadDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  return {
    bapUrl: env.BAP_URL ?? 'http://localhost:3001',
    amUrl: env.ACCESS_MANAGER_URL ?? 'http://localhost:3003',
    granteeId: env.GRANTEE_ID ?? 'claude-agent',
    downloadDir: resolve(env.DOWNLOAD_DIR ?? resolve(homedir(), 'bdc-downloads')),
  };
}
