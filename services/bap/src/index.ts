/**
 * BAP — Beckn Application Platform (consumer gateway / orchestrator).
 *
 * Phase 0 stub: boots a Fastify server exposing GET /health so the service
 * health-checks green under Docker Compose. Search fan-out, on_search
 * aggregation, and select/init/confirm orchestration arrive in Phase 4.
 */
import Fastify from 'fastify';

const SERVICE_NAME = 'bap';
const PORT = Number(process.env.PORT ?? 3001);
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
