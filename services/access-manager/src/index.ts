/**
 * Access Manager — consent-artifact / Access Grant issuer.
 *
 * Phase 0 stub: boots a Fastify server exposing GET /health. In Phase 4 this
 * issues, tracks, and revokes signed Access Grants (the DEPA-inspired consent
 * artifacts), runs the expiry sweep, and serves grant history. This is the
 * novel core of the project.
 */
import Fastify from 'fastify';

const SERVICE_NAME = 'access-manager';
const PORT = Number(process.env.PORT ?? 3003);
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
