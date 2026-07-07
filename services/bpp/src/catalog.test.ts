import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BppCatalog } from './catalog.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const TABULAR = resolve(ROOT, 'seed-data/catalogs/tabular.catalog.json');
const DATA_DIR = resolve(ROOT, 'seed-data/files');

const load = () => BppCatalog.load(TABULAR, DATA_DIR);

describe('BppCatalog', () => {
  it('loads and validates the generated seed catalog', () => {
    const c = load();
    expect(c.catalog.bppId).toBe('bpp.tabular.local');
    expect(c.catalog.offers.length).toBe(2);
  });

  it('returns all offers for an empty intent', () => {
    expect(load().search({}).offers.length).toBe(2);
  });

  it('filters by taskType', () => {
    const res = load().search({ taskType: 'regression' });
    expect(res.offers.map((o) => o.id)).toEqual(['offer-housing-full']);
    // only the covered resource is kept
    expect(res.resources.map((r) => r.id)).toEqual(['ds-housing']);
  });

  it('filters by minRows', () => {
    expect(
      load()
        .search({ minRows: 2800 })
        .offers.map((o) => o.id),
    ).toEqual(['offer-churn-full']);
  });

  it('filters by free-text query', () => {
    expect(
      load()
        .search({ query: 'churn' })
        .offers.map((o) => o.id),
    ).toEqual(['offer-churn-full']);
  });

  it('returns no offers when nothing matches', () => {
    expect(load().search({ modality: 'image' }).offers.length).toBe(0);
  });

  it('resolves the full file for an offer', () => {
    const f = load().resolveFile({
      resourceId: 'ds-churn',
      offerId: 'offer-churn-full',
      scopeKind: 'full',
    });
    expect(f?.filename).toBe('churn.csv');
    expect(f?.contentType).toBe('text/csv');
  });

  it('prefers a sample file for sample scope', () => {
    const f = load().resolveFile({
      resourceId: 'ds-churn',
      offerId: 'offer-churn-full',
      scopeKind: 'sample',
    });
    expect(f?.filename).toBe('churn.sample.csv');
  });

  it('returns undefined for an unknown offer', () => {
    expect(
      load().resolveFile({ resourceId: 'x', offerId: 'nope', scopeKind: 'full' }),
    ).toBeUndefined();
  });
});
