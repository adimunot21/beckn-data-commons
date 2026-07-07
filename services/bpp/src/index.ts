/**
 * BPP — Beckn Provider Platform (config-driven dataset/model provider).
 *
 * Phase 0 stub: boots a Fastify server exposing GET /health. In Phase 3 this
 * becomes the generic, config-driven provider (run 3x with different synthetic
 * catalogs) implementing on_search/on_select/on_init/on_confirm, the
 * grant-issuance hook, and the grant-validating download endpoint.
 */
import Fastify from 'fastify';

const SERVICE_NAME = 'bpp';
const PORT = Number(process.env.PORT ?? 3002);
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
