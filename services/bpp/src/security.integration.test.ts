/**
 * Security integration test: the real BPP app with per-hop message auth wired,
 * proving it rejects forged, tampered, replayed, and untrusted Beckn requests
 * while accepting a correctly signed one. Complements the crypto-utils unit tests
 * (which prove the auth primitive) by exercising the enforcement in the route.
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createParticipantAuth,
  generateKeyPair,
  type KeyPair,
  type ParticipantAuth,
} from '@bdc/crypto-utils';
import { createApp, type CallbackDispatcher } from './app.js';
import { BppCatalog } from './catalog.js';
import { InMemoryRedemptionStore, InMemoryRevocationStore } from './stores/memory.js';
import type { BppConfig } from './config.js';

const NOW_MS = 1_800_000_000_000;
const ROOT = resolve(import.meta.dirname, '../../..');

let app: FastifyInstance;
let bapAuth: ParticipantAuth; // the legitimate BAP signer
let evilAuth: ParticipantAuth; // an untrusted signer

const dispatch: CallbackDispatcher = async () => {};

function config(amKey: KeyPair): BppConfig {
  return {
    serviceName: 'bpp:test',
    port: 0,
    host: '127.0.0.1',
    bppId: 'bpp.tabular.local',
    bppUri: 'http://bpp.tabular.local',
    catalogFile: resolve(ROOT, 'seed-data/catalogs/tabular.catalog.json'),
    dataDir: resolve(ROOT, 'seed-data/files'),
    accessManagerPublicKey: amKey.publicKey,
    databaseUrl: undefined,
    clockSkewSeconds: 30,
  };
}

function discover(message: unknown = { intent: { query: 'churn' } }) {
  return {
    context: {
      networkId: 'nfh.global/testnet-ddm',
      action: 'discover',
      version: '2.0.0',
      bapId: 'bap.bdc.local',
      bapUri: 'http://bap.bdc.local',
      transactionId: randomUUID(),
      messageId: randomUUID(),
      timestamp: new Date(NOW_MS).toISOString(),
      ttl: 'PT30S',
    },
    message,
  };
}

async function post(env: unknown, authorization?: string) {
  return app.inject({
    method: 'POST',
    url: '/discover',
    headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
    payload: env as object,
  });
}

beforeAll(async () => {
  const [bap, bpp, am, evil] = await Promise.all([
    generateKeyPair(),
    generateKeyPair(),
    generateKeyPair(),
    generateKeyPair(),
  ]);
  const registry = new Map([
    ['bap.bdc.local', bap.publicKey],
    ['bpp.tabular.local', bpp.publicKey],
  ]);
  const now = () => NOW_MS;
  bapAuth = createParticipantAuth({
    keyId: 'bap.bdc.local',
    privateKeyHex: bap.privateKey,
    registry,
    now,
  });
  const bppAuth = createParticipantAuth({
    keyId: 'bpp.tabular.local',
    privateKeyHex: bpp.privateKey,
    registry,
    now,
  });
  // Untrusted: signs as an id that is not in the registry.
  evilAuth = createParticipantAuth({
    keyId: 'evil.local',
    privateKeyHex: evil.privateKey,
    registry,
    now,
  });

  app = createApp({
    config: config(am),
    catalog: BppCatalog.load(config(am).catalogFile, config(am).dataDir),
    revocations: new InMemoryRevocationStore(),
    redemptions: new InMemoryRedemptionStore(),
    dispatch,
    now: () => new Date(NOW_MS),
    verifyRequest: bppAuth.verify,
    signCallback: bppAuth.sign,
    logger: false,
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('BPP per-hop message auth (enforcement)', () => {
  it('accepts a correctly signed request', async () => {
    const env = discover();
    const res = await post(env, await bapAuth.sign(env));
    expect(res.statusCode).toBe(200);
    expect(res.json().message.status).toBe('ACK');
  });

  it('rejects a request with no signature (401)', async () => {
    const res = await post(discover());
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('missing');
  });

  it('rejects an untrusted signer (401 unknown-key)', async () => {
    const env = discover();
    const res = await post(env, await evilAuth.sign(env));
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('unknown-key');
  });

  it('rejects a tampered body (401 bad-signature)', async () => {
    const env = discover({ intent: { query: 'churn' } });
    const header = await bapAuth.sign(env);
    const tampered = { ...env, message: { intent: { query: 'medical-records' } } };
    const res = await post(tampered, header);
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('bad-signature');
  });

  it('rejects a replayed request (same nonce, 401 replayed)', async () => {
    const env = discover();
    const header = await bapAuth.sign(env);
    const first = await post(env, header);
    expect(first.statusCode).toBe(200);
    const second = await post(env, header); // identical signed message
    expect(second.statusCode).toBe(401);
    expect(second.json().error.message).toBe('replayed');
  });
});
