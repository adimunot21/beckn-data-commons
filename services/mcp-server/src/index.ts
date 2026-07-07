/**
 * MCP Server — Model Context Protocol bridge to the BDC network.
 *
 * Phase 0 stub: boots a Fastify server exposing GET /health for orchestration.
 * In Phase 5 this exposes MCP tools (search_resources, view_resource,
 * request_access, confirm_access, list_my_grants, revoke_grant, download) so any
 * MCP client (Claude) can transact on the network in natural language. The HTTP
 * health endpoint remains for Docker orchestration alongside the MCP transport.
 */
import Fastify from 'fastify';

const SERVICE_NAME = 'mcp-server';
const PORT = Number(process.env.PORT ?? 3004);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  status: 'ok',
  service: SERVICE_NAME,
  timestamp: new Date().toISOString(),
}));

async function start(): Promise<void> {
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
