import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SignedAccessGrant } from '@bdc/beckn-schemas';
import { createApp } from './app.js';
import { BapOrchestrator } from './orchestrator.js';
import type { BapConfig } from './config.js';
import type { AmClient, BppTransport } from './transport.js';

type Json = Record<string, unknown>;

const config: BapConfig = {
  serviceName: 'bap',
  port: 0,
  host: '127.0.0.1',
  bapId: 'bap.test',
  bapUri: 'http://bap.test',
  networkId: 'nfh.global/testnet-ddm',
  bpps: [
    { bppId: 'bpp.a', uri: 'http://a' },
    { bppId: 'bpp.b', uri: 'http://b' },
  ],
  accessManagerUrl: 'http://am',
  aggregationWindowMs: 100,
  messageTtl: 'PT30S',
};

let app: FastifyInstance;

beforeAll(async () => {
  let deliver: (env: unknown) => void = () => {};
  const transport: BppTransport = {
    async send(_uri, action, envelope) {
      const ctx = (envelope as { context: Json }).context;
      const message =
        action === 'discover'
          ? { catalogs: [{ id: `catalog-${String(ctx.bppId)}`, bppId: ctx.bppId }] }
          : { contract: { id: 'c', status: { code: action === 'select' ? 'DRAFT' : 'ACTIVE' } } };
      setImmediate(() => deliver({ context: { ...ctx, action: `on_${action}` }, message }));
    },
  };
  const amClient: AmClient = {
    async issue() {
      return {
        claims: { grantId: 'g1' },
        alg: 'ed25519',
        signature: 'x',
      } as unknown as SignedAccessGrant;
    },
  };
  const orchestrator = new BapOrchestrator({ config, transport, amClient, windowMs: 100 });
  deliver = (env) => orchestrator.deliverCallback(env);
  app = createApp({ config, orchestrator, logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('BAP HTTP API', () => {
  it('search aggregates catalogs from all BPPs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/search',
      payload: { intent: { query: 'x' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().catalogs.length).toBe(2);
    expect(typeof res.json().transactionId).toBe('string');
  });

  it('callback endpoints ACK', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/on_discover',
      payload: { context: { action: 'on_discover', transactionId: randomUUID() }, message: {} },
    });
    expect(res.json().message.status).toBe('ACK');
  });

  it('select validates required fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/select', payload: { bppId: 'bpp.a' } });
    expect(res.statusCode).toBe(400);
  });

  it('confirm returns a contract and a grant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/confirm',
      payload: {
        transactionId: randomUUID(),
        bppId: 'bpp.a',
        offerId: 'offer-a',
        resourceId: 'ds-a',
        grantee: { id: 'agent-1' },
        purpose: 'research',
        licenseClass: 'permissive',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().grant.claims.grantId).toBe('g1');
  });

  it('confirm rejects a bad licenseClass', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/confirm',
      payload: {
        transactionId: randomUUID(),
        bppId: 'bpp.a',
        offerId: 'offer-a',
        resourceId: 'ds-a',
        grantee: { id: 'agent-1' },
        purpose: 'research',
        licenseClass: 'gpl-3',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
