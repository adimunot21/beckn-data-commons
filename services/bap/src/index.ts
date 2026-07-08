/**
 * BAP entrypoint — consumer gateway / orchestrator. Fans discover out to the
 * configured BPPs, aggregates on_* callbacks, and calls the Access Manager at
 * confirm. No database: the BAP holds only short-lived in-flight aggregation state.
 */
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { BapOrchestrator } from './orchestrator.js';
import { httpAmClient, httpBppTransport } from './transport.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const orchestrator = new BapOrchestrator({
    config,
    transport: httpBppTransport,
    amClient: httpAmClient(config.accessManagerUrl),
  });

  const app = createApp({ config, orchestrator });

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      { bapId: config.bapId, bpps: config.bpps.map((b) => b.bppId), am: config.accessManagerUrl },
      'BAP up',
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
