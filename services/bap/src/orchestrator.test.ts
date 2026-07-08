import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SignedAccessGrant } from '@bdc/beckn-schemas';
import { BapOrchestrator, TimeoutError } from './orchestrator.js';
import type { BapConfig } from './config.js';
import type { AmClient, BppTransport } from './transport.js';

type Json = Record<string, unknown>;

function testConfig(): BapConfig {
  return {
    serviceName: 'bap',
    port: 0,
    host: '127.0.0.1',
    bapId: 'bap.test',
    bapUri: 'http://bap.test',
    networkId: 'nfh.global/testnet-ddm',
    bpps: [
      { bppId: 'bpp.a', uri: 'http://a' },
      { bppId: 'bpp.b', uri: 'http://b' },
      { bppId: 'bpp.c', uri: 'http://c' },
    ],
    accessManagerUrl: 'http://am',
    aggregationWindowMs: 100,
    messageTtl: 'PT30S',
  };
}

function cannedMessage(action: string, bppId: string): Json {
  if (action === 'discover') {
    return { catalogs: [{ id: `catalog-${bppId}`, bppId, offers: [{ id: `offer-${bppId}` }] }] };
  }
  const code = action === 'select' ? 'DRAFT' : 'ACTIVE';
  return {
    contract: {
      id: `contract-${bppId}`,
      status: { code },
      performance: action === 'confirm' ? [{}] : undefined,
    },
  };
}

/** A fake BPP layer: on send, simulates the provider POSTing on_<action> back. */
function makeHarness(opts: { silent?: Set<string> } = {}) {
  const silent = opts.silent ?? new Set<string>();
  const sent: { uri: string; action: string; envelope: Json }[] = [];
  const issued: unknown[] = [];
  let deliver: (env: unknown) => void = () => {};

  const transport: BppTransport = {
    async send(uri, action, envelope) {
      sent.push({ uri, action, envelope: envelope as Json });
      const ctx = (envelope as { context: Json }).context;
      if (silent.has(String(ctx.bppId))) return; // ACK but never call back
      setImmediate(() =>
        deliver({
          context: { ...ctx, action: `on_${action}` },
          message: cannedMessage(action, String(ctx.bppId)),
        }),
      );
    },
  };

  const grant = {
    claims: { grantId: 'g1' },
    alg: 'ed25519',
    signature: 'x',
  } as unknown as SignedAccessGrant;
  const amClient: AmClient = {
    async issue(req) {
      issued.push(req);
      return grant;
    },
  };

  const orchestrator = new BapOrchestrator({
    config: testConfig(),
    transport,
    amClient,
    windowMs: 100,
  });
  deliver = (env) => orchestrator.deliverCallback(env);
  return { orchestrator, sent, issued, grant };
}

describe('BapOrchestrator', () => {
  it('fans discover out to all BPPs and aggregates their catalogs', async () => {
    const h = makeHarness();
    const res = await h.orchestrator.search({ query: 'churn' });
    expect(res.catalogs.length).toBe(3);
    expect(res.providers.sort()).toEqual(['bpp.a', 'bpp.b', 'bpp.c']);
    expect(h.sent.filter((s) => s.action === 'discover').length).toBe(3);
  });

  it('returns partial results when a BPP does not call back within the window', async () => {
    const h = makeHarness({ silent: new Set(['bpp.c']) });
    const res = await h.orchestrator.search({});
    expect(res.catalogs.length).toBe(2);
    expect(res.providers).not.toContain('bpp.c');
  });

  it('ignores callbacks for an unknown transaction', () => {
    const h = makeHarness();
    // Should not throw; simply dropped.
    h.orchestrator.deliverCallback({
      context: { action: 'on_discover', transactionId: randomUUID() },
      message: {},
    });
  });

  it('select returns the DRAFT contract from the chosen BPP', async () => {
    const h = makeHarness();
    const contract = await h.orchestrator.select(randomUUID(), 'bpp.a', 'offer-bpp.a');
    expect((contract.status as Json).code).toBe('DRAFT');
  });

  it('confirm returns the contract and an AM-issued grant with the right request', async () => {
    const h = makeHarness();
    const txn = randomUUID();
    const out = await h.orchestrator.confirm({
      transactionId: txn,
      bppId: 'bpp.a',
      offerId: 'offer-bpp.a',
      resourceId: 'ds-a',
      grantee: { id: 'agent-1' },
      purpose: 'research',
      licenseClass: 'permissive',
    });
    expect(out.grant).toBe(h.grant);
    expect(h.issued).toHaveLength(1);
    expect(h.issued[0]).toMatchObject({
      provider: { bppId: 'bpp.a', bppUri: 'http://a' },
      resource: { resourceId: 'ds-a', offerId: 'offer-bpp.a' },
      transactionId: txn,
      scope: { kind: 'full' },
    });
  });

  it('rejects an unknown bppId', async () => {
    const h = makeHarness();
    await expect(h.orchestrator.select(randomUUID(), 'bpp.nope', 'o')).rejects.toThrow(
      /Unknown bppId/,
    );
  });

  it('times out when the chosen BPP never calls back', async () => {
    const h = makeHarness({ silent: new Set(['bpp.a']) });
    await expect(h.orchestrator.select(randomUUID(), 'bpp.a', 'o')).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });
});
