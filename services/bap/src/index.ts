/**
 * BAP entrypoint — consumer gateway / orchestrator. Fans discover out to the
 * configured BPPs, aggregates on_* callbacks, and calls the Access Manager at
 * confirm. No database: the BAP holds only short-lived in-flight aggregation state.
 */
import { createParticipantAuth, parseKeyRegistry } from '@bdc/crypto-utils';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { BapOrchestrator } from './orchestrator.js';
import { httpAmClient, httpBppTransport } from './transport.js';

/**
 * Build this participant's message-auth. Mandatory in production: without a
 * signing key and a trusted-key registry the BAP refuses to boot — there is no
 * unauthenticated mode.
 */
function requireAuth(keyId: string, clockSkewSeconds: number) {
  const privateKeyHex = process.env.BECKN_PRIVATE_KEY;
  const registrySpec = process.env.BECKN_REGISTRY;
  if (!privateKeyHex || !registrySpec) {
    throw new Error(
      'BECKN_PRIVATE_KEY and BECKN_REGISTRY are required — per-hop message auth is mandatory',
    );
  }
  return createParticipantAuth({
    keyId,
    privateKeyHex,
    registry: parseKeyRegistry(registrySpec),
    ttlSeconds: 30,
    clockSkewSeconds,
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const auth = requireAuth(config.bapId, 5);
  const orchestrator = new BapOrchestrator({
    config,
    transport: httpBppTransport,
    amClient: httpAmClient(config.accessManagerUrl, auth.sign),
    signOutbound: auth.sign,
  });

  const app = createApp({ config, orchestrator, verifyCallback: auth.verify });

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
