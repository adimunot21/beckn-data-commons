import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BecknContext } from '@bdc/beckn-schemas';
import { BppCatalog } from '../catalog.js';
import {
  buildOnConfirm,
  buildOnDiscover,
  buildOnInit,
  buildOnSelect,
  extractIntent,
  extractOfferId,
  type BuildDeps,
} from './builders.js';

const ROOT = resolve(import.meta.dirname, '../../../..');
const catalog = BppCatalog.load(
  resolve(ROOT, 'seed-data/catalogs/tabular.catalog.json'),
  resolve(ROOT, 'seed-data/files'),
);

const deps: BuildDeps = {
  responder: { bppId: 'bpp.tabular.local', bppUri: 'http://localhost:3002' },
  nowIso: '2026-07-07T12:00:00Z',
};

function reqContext(action: string): BecknContext {
  return BecknContext.parse({
    networkId: 'nfh.global/testnet-ddm',
    action,
    version: '2.0.0',
    bapId: 'bap.local',
    bapUri: 'http://localhost:3001',
    transactionId: randomUUID(),
    messageId: randomUUID(),
    timestamp: '2026-07-07T11:59:59Z',
    ttl: 'PT30S',
  });
}

describe('intent + offer extraction', () => {
  it('extracts a structured intent', () => {
    expect(extractIntent({ intent: { modality: 'tabular', taskType: 'classification' } })).toEqual({
      modality: 'tabular',
      taskType: 'classification',
    });
  });

  it('falls back to descriptor.name as query', () => {
    expect(extractIntent({ intent: { descriptor: { name: 'churn' } } })).toEqual({
      query: 'churn',
    });
  });

  it('ignores unknown enum values rather than throwing', () => {
    expect(extractIntent({ intent: { modality: 'hologram' } })).toEqual({});
  });

  it('extracts offerId from a contract message', () => {
    expect(extractOfferId({ contract: { offers: [{ id: 'offer-churn-full' }] } })).toBe(
      'offer-churn-full',
    );
  });
});

describe('on_discover', () => {
  it('returns a filtered catalog and flips the action', () => {
    const res = buildOnDiscover(
      reqContext('discover'),
      catalog,
      { intent: { query: 'churn' } },
      deps,
    );
    expect(res.context.action).toBe('on_discover');
    expect(res.context.bppId).toBe('bpp.tabular.local');
    const catalogs = res.message.catalogs as unknown[];
    expect(catalogs.length).toBe(1);
  });

  it('returns empty catalogs when nothing matches', () => {
    const res = buildOnDiscover(
      reqContext('discover'),
      catalog,
      { intent: { modality: 'image' } },
      deps,
    );
    expect((res.message.catalogs as unknown[]).length).toBe(0);
  });
});

describe('contract lifecycle', () => {
  const msg = { contract: { offers: [{ id: 'offer-churn-full' }] } };

  it('on_select -> DRAFT', () => {
    const res = buildOnSelect(reqContext('select'), catalog, msg, deps);
    expect((res.message.contract as Record<string, unknown>).status).toEqual({ code: 'DRAFT' });
  });

  it('on_init -> ACTIVE', () => {
    const res = buildOnInit(reqContext('init'), catalog, msg, deps);
    expect((res.message.contract as Record<string, unknown>).status).toEqual({ code: 'ACTIVE' });
  });

  it('on_confirm -> ACTIVE with a grant-gated download URL', () => {
    const res = buildOnConfirm(reqContext('confirm'), catalog, msg, deps);
    const contract = res.message.contract as Record<string, unknown>;
    expect(contract.status).toEqual({ code: 'ACTIVE' });
    const perf = (contract.performance as Record<string, unknown>[])[0]!;
    const attrs = perf.performanceAttributes as Record<string, unknown>;
    expect(attrs['fulfillment:accessMethod']).toBe('DOWNLOAD');
    expect(attrs['fulfillment:accessUrl']).toContain('/download?offerId=offer-churn-full');
    expect(attrs['bdc:requiresGrant']).toBe(true);
  });
});
