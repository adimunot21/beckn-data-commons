/**
 * The strongest schema test: our Zod schemas must accept the REAL captured Beckn
 * v2 DDM payloads (docs/protocol-samples/ddm/). If the sandbox/Fabric changes a
 * shape, this fails and tells us to re-inspect — exactly the guard the
 * inspect-before-integrating rule wants.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { becknEnvelope } from './context.js';
import { OnDiscoverMessage } from './catalog.js';
import { ContractMessage } from './contract.js';

const SAMPLES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/protocol-samples/ddm',
);

const load = (name: string): unknown => JSON.parse(readFileSync(path.join(SAMPLES, name), 'utf-8'));

describe('real captured DDM payloads validate against our schemas', () => {
  it('on_discover (static sample) parses as an envelope of catalogs', () => {
    const parsed = becknEnvelope(OnDiscoverMessage).parse(load('on_discover.json'));
    expect(parsed.context.action).toBe('on_discover');
    expect(parsed.message.catalogs.length).toBeGreaterThan(0);
    const offer = parsed.message.catalogs[0]!.offers[0]!;
    expect(offer.offerAttributes['@type']).toBe('DatasetItem');
    expect(offer.offerAttributes['dataset:rowCountEstimate']).toBeTypeOf('number');
  });

  it('on_discover (live async callback) parses too', () => {
    const parsed = becknEnvelope(OnDiscoverMessage).parse(load('on_discover.live-callback.json'));
    expect(parsed.context.action).toBe('on_discover');
    expect(parsed.context.transactionId).toBeTruthy();
  });

  it('on_select parses; contract is DRAFT with no fulfillment', () => {
    const parsed = becknEnvelope(ContractMessage).parse(load('on_select.json'));
    expect(parsed.message.contract.status.code).toBe('DRAFT');
    expect(parsed.message.contract.performance).toBeUndefined();
  });

  it('on_init parses; contract is ACTIVE', () => {
    const parsed = becknEnvelope(ContractMessage).parse(load('on_init.json'));
    expect(parsed.message.contract.status.code).toBe('ACTIVE');
  });

  it('on_confirm parses; performance carries DatasetFulfillment access', () => {
    const parsed = becknEnvelope(ContractMessage).parse(load('on_confirm.json'));
    const perf = parsed.message.contract.performance?.[0];
    expect(perf).toBeDefined();
    expect(perf!.performanceAttributes['fulfillment:accessMethod']).toBe('DOWNLOAD');
    expect(perf!.performanceAttributes['fulfillment:accessUrl']).toContain('http');
  });
});
