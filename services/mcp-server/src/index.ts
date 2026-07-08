#!/usr/bin/env node
/**
 * BDC MCP server entrypoint (stdio). Launched by an MCP client (Claude Desktop /
 * Claude Code) as a subprocess; it bridges to the BDC backend over localhost.
 *
 * IMPORTANT: stdout is the MCP protocol channel — never write to it. Diagnostics
 * go to stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { HttpBdcGateway } from './gateway.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const gateway = new HttpBdcGateway({ bapUrl: config.bapUrl, amUrl: config.amUrl });
  const server = createServer({ config, gateway });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[bdc-mcp] connected (BAP=${config.bapUrl}, AM=${config.amUrl}, downloads=${config.downloadDir})`,
  );
}

main().catch((err) => {
  console.error('[bdc-mcp] fatal:', err);
  process.exit(1);
});
