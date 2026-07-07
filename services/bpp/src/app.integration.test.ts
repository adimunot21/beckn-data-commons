/**
 * Integration test: the real Fastify BPP app, driven via inject with in-memory
 * stores, a recording callback dispatcher, and a fixed clock. Proves the
 * end-to-end grant-gated flow AND the Phase 3 rejection bar (expired /
 * wrong-scope / revoked) against a running app — no DB, no network.
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { generateKeyPair, type KeyPair } from '@bdc/crypto-utils';
import {
  AccessGrantClaims,
  issueGrant,
  type AccessGrantClaims as Claims,
} from '@bdc/beckn-schemas';
import { createApp, type CallbackDispatcher } from './app.js';
import { BppCatalog } from './catalog.js';
import { InMemoryRedemptionStore, InMemoryRevocationStore } from './stores/memory.js';
import { encodePresentedGrant } from './download.js';
import type { BppConfig } from './config.js';

const NOW = 1_800_000_000;
const ROOT = resolve(import.meta.dirname, '../../..');

let am: KeyPair;
let app: FastifyInstance;
let revocations: InMemoryRevocationStore;
let redemptions: InMemoryRedemptionStore;
const dispatched: { url: string; payload: unknown }[] = [];

const dispatch: CallbackDispatcher = async (url, payload) => {
  dispatched.push({ url, payload });
};

function config(am: KeyPair): BppConfig {
  return {
    serviceName: 'bpp:test',
    port: 0,
    host: '127.0.0.1',
    bppId: 'bpp.tabular.local',
    bppUri: 'http://bpp.tabular.local',
    catalogFile: resolve(ROOT, 'seed-data/catalogs/tabular.catalog.json'),
    dataDir: resolve(ROOT, 'seed-data/files'),
    accessManagerPublicKey: am.publicKey,
    databaseUrl: undefined,
    clockSkewSeconds: 30,
  };
}

function grantClaims(overrides: Partial<Claims> = {}): Claims {
  return AccessGrantClaims.parse({
    v: 'bdc-grant/1',
    grantId: randomUUID(),
    issuer: 'access-manager.bdc.local',
    issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
    grantee: { id: 'agent-42' },
    provider: { bppId: 'bpp.tabular.local', bppUri: 'http://bpp.tabular.local' },
    resource: { resourceId: 'ds-churn', offerId: 'offer-churn-full' },
    scope: { kind: 'full' },
    licenseClass: 'permissive',
    purpose: 'train a churn classifier',
    transactionId: randomUUID(),
    issuedAt: NOW,
    notBefore: NOW,
    expiresAt: NOW + 3600,
    revocable: true,
    nonce: randomUUID(),
    ...overrides,
  });
}

const DOWNLOAD_URL = '/download?resourceId=ds-churn&offerId=offer-churn-full';

beforeAll(async () => {
  am = await generateKeyPair();
  revocations = new InMemoryRevocationStore();
  redemptions = new InMemoryRedemptionStore();
  app = createApp({
    config: config(am),
    catalog: BppCatalog.load(config(am).catalogFile, config(am).dataDir),
    revocations,
    redemptions,
    dispatch,
    now: () => new Date(NOW * 1000),
    logger: false,
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('BPP app — Beckn flow', () => {
  it('discover returns a synchronous ACK and fires an async on_discover callback', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/discover',
      payload: {
        context: {
          networkId: 'nfh.global/testnet-ddm',
          action: 'discover',
          version: '2.0.0',
          bapId: 'bap.local',
          bapUri: 'http://bap.local',
          transactionId: randomUUID(),
          messageId: randomUUID(),
          timestamp: '2026-07-07T12:00:00Z',
          ttl: 'PT30S',
        },
        message: { intent: { query: 'churn' } },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().message.status).toBe('ACK');

    const call = dispatched.at(-1)!;
    expect(call.url).toBe('http://bap.local/on_discover');
    const payload = call.payload as {
      context: { action: string };
      message: { catalogs: unknown[] };
    };
    expect(payload.context.action).toBe('on_discover');
    expect(payload.message.catalogs.length).toBe(1);
  });

  it('rejects a message with an invalid context (NACK 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/select',
      payload: { context: { bad: true } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message.status).toBe('NACK');
  });
});

describe('BPP app — grant-gated download', () => {
  it('serves the file for a valid grant', async () => {
    const grant = await issueGrant(grantClaims(), am.privateKey);
    const res = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: encodePresentedGrant(grant) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('customer_id');
    expect(res.headers['x-bdc-redemption-count']).toBe('1');
  });

  it('401 when no grant is presented', async () => {
    const res = await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('grant-required');
  });

  it('403 for an expired grant', async () => {
    const grant = await issueGrant(
      grantClaims({ notBefore: NOW - 7200, expiresAt: NOW - 100 }),
      am.privateKey,
    );
    const res = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: encodePresentedGrant(grant) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('expired');
  });

  it('403 for a wrong-scope (subset overreach) grant', async () => {
    const grant = await issueGrant(
      grantClaims({ scope: { kind: 'subset', fields: ['age'] } }),
      am.privateKey,
    );
    const res = await app.inject({
      method: 'GET',
      url: `${DOWNLOAD_URL}&fields=age,monthly_charges`,
      headers: { authorization: encodePresentedGrant(grant) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('scope-insufficient');
  });

  it('403 for a revoked grant, even though it is validly signed and unexpired', async () => {
    const claims = grantClaims();
    const grant = await issueGrant(claims, am.privateKey);
    // First redemption works...
    const ok = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: encodePresentedGrant(grant) },
    });
    expect(ok.statusCode).toBe(200);
    // ...then the Access Manager revokes it (shared store)...
    await revocations.revoke(claims.grantId, 'user revoked');
    const denied = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: encodePresentedGrant(grant) },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error).toBe('revoked');
  });
});
