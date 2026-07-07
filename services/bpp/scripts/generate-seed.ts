/**
 * Deterministic synthetic seed generator for the 3 BDC providers.
 *
 * Produces DDM-aligned catalogs (validated against @bdc/beckn-schemas Catalog)
 * plus small, real downloadable files — so the network is fully self-contained
 * and clone-and-runnable, with zero real-world dataset licensing questions.
 *
 * Run: pnpm --filter @bdc/bpp seed:gen
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Catalog } from '@bdc/beckn-schemas';

const ROOT = resolve(import.meta.dirname, '../../..');
const CATALOGS_DIR = resolve(ROOT, 'seed-data/catalogs');
const FILES_DIR = resolve(ROOT, 'seed-data/files');

/** Seeded PRNG (mulberry32) for reproducible synthetic data. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

interface OfferFiles {
  full: string;
  sample?: string;
}
interface SeedFile {
  catalog: unknown;
  files: Record<string, OfferFiles>;
}

/** Build a DDM DatasetItem-shaped offerAttributes object with our BDC overlay. */
function datasetItem(o: {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  dataType: string;
  resourceKind: 'dataset' | 'model';
  modality: string;
  taskType: string;
  licenseClass: string;
}): Record<string, unknown> {
  return {
    '@context':
      'https://raw.githubusercontent.com/beckn/DDM/main/specification/schema/DatasetItem/v1/context.jsonld',
    '@type': 'DatasetItem',
    'schema:identifier': o.id,
    'schema:name': o.name,
    'schema:description': o.description,
    'schema:temporalCoverage': '2025-01-01/2025-12-31',
    'schema:license': CC_BY,
    'schema:conditionsOfAccess': 'Attribution required; no resale of raw data.',
    'dataset:accessMethod': 'DOWNLOAD',
    'dataset:rowCountEstimate': o.rows,
    'dataset:columnCount': o.cols,
    'dataset:dataType': o.dataType,
    'dataset:refreshType': 'STATIC',
    'dataset:sensitivityLevel': 'PUBLIC',
    // BDC normalized overlay (our own namespace; passthrough-safe):
    'bdc:resourceKind': o.resourceKind,
    'bdc:modality': o.modality,
    'bdc:taskType': o.taskType,
    'bdc:licenseClass': o.licenseClass,
  };
}

function priceConsideration(id: string, value: number): Record<string, unknown> {
  return {
    id: `consideration-${id}`,
    status: { code: 'ACTIVE' },
    considerationAttributes: {
      '@type': 'PriceSpecification',
      currency: 'INR',
      value,
      components: [{ type: 'UNIT', value, currency: 'INR', description: 'One-time access' }],
    },
  };
}

// ---------------------------------------------------------------------------
// File generators (return the file's relative path under FILES_DIR)
// ---------------------------------------------------------------------------

function writeCsv(rel: string, header: string[], rows: string[][]): string {
  const abs = resolve(FILES_DIR, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  const body = [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';
  writeFileSync(abs, body);
  return rel;
}

function writeNdjson(rel: string, records: unknown[]): string {
  const abs = resolve(FILES_DIR, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return rel;
}

function writeJson(rel: string, obj: unknown): string {
  const abs = resolve(FILES_DIR, rel);
  mkdirSync(resolve(abs, '..'), { recursive: true });
  writeFileSync(abs, JSON.stringify(obj, null, 2));
  return rel;
}

/** Synthetic churn-style tabular dataset. */
function genChurn(rel: string, n: number, seed: number): string {
  const r = rng(seed);
  const header = ['customer_id', 'age', 'tenure_months', 'monthly_charges', 'contract', 'churn'];
  const contracts = ['month-to-month', 'one-year', 'two-year'];
  const rows: string[][] = [];
  for (let i = 0; i < n; i++) {
    const age = 18 + Math.floor(r() * 60);
    const tenure = Math.floor(r() * 72);
    const charges = (20 + r() * 100).toFixed(2);
    const contract = contracts[Math.floor(r() * contracts.length)]!;
    // churn more likely for short tenure + month-to-month
    const churnProb = (contract === 'month-to-month' ? 0.4 : 0.15) + (tenure < 12 ? 0.2 : 0);
    const churn = r() < churnProb ? 1 : 0;
    rows.push([`cust-${i}`, String(age), String(tenure), charges, contract, String(churn)]);
  }
  return writeCsv(rel, header, rows);
}

/** Synthetic housing-price regression dataset. */
function genHousing(rel: string, n: number, seed: number): string {
  const r = rng(seed);
  const header = ['id', 'area_sqft', 'bedrooms', 'age_years', 'distance_km', 'price'];
  const rows: string[][] = [];
  for (let i = 0; i < n; i++) {
    const area = 400 + Math.floor(r() * 3600);
    const beds = 1 + Math.floor(r() * 5);
    const age = Math.floor(r() * 50);
    const dist = (r() * 30).toFixed(1);
    const price = Math.round(
      area * 3000 + beds * 250000 - age * 15000 - Number(dist) * 40000 + r() * 500000,
    );
    rows.push([`h-${i}`, String(area), String(beds), String(age), dist, String(price)]);
  }
  return writeCsv(rel, header, rows);
}

/** Synthetic "image" dataset as NDJSON of tiny 8x8 grayscale shapes. */
function genShapes(rel: string, n: number, seed: number): string {
  const r = rng(seed);
  const labels = ['circle', 'square', 'triangle'];
  const records: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const label = labels[Math.floor(r() * labels.length)]!;
    const pixels = Array.from({ length: 64 }, () => Math.floor(r() * 256));
    records.push({ id: `img-${i}`, label, width: 8, height: 8, pixels });
  }
  return writeNdjson(rel, records);
}

/** Synthetic small pretrained model: a logistic-regression weight vector. */
function genLogRegModel(rel: string, features: string[], seed: number): string {
  const r = rng(seed);
  return writeJson(rel, {
    format: 'bdc-model/1',
    architecture: 'logistic-regression',
    task: 'binary-classification',
    features,
    weights: features.map(() => Number((r() * 2 - 1).toFixed(4))),
    bias: Number((r() * 2 - 1).toFixed(4)),
    trainedOn: 'synthetic-churn',
  });
}

/** Synthetic tiny MLP (2-layer) for digit-ish classification. */
function genTinyMlp(rel: string, seed: number): string {
  const r = rng(seed);
  const w = (rows: number, cols: number) =>
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => Number((r() * 2 - 1).toFixed(3))),
    );
  return writeJson(rel, {
    format: 'bdc-model/1',
    architecture: 'mlp',
    task: 'multiclass-classification',
    layers: [
      { name: 'dense1', shape: [64, 16], weights: w(64, 16) },
      { name: 'dense2', shape: [16, 3], weights: w(16, 3) },
    ],
    classes: ['circle', 'square', 'triangle'],
  });
}

// ---------------------------------------------------------------------------
// Catalog assembly
// ---------------------------------------------------------------------------

function buildTabular(): SeedFile {
  const bppId = 'bpp.tabular.local';
  const churnFull = genChurn('tabular/churn.csv', 3000, 101);
  const churnSample = genChurn('tabular/churn.sample.csv', 50, 101);
  const housingFull = genHousing('tabular/housing.csv', 2500, 202);
  const catalog = {
    id: 'catalog-synthtab',
    descriptor: { name: 'SynthTab Labs — Tabular Datasets' },
    bppId,
    bppUri: 'http://localhost:3002',
    provider: { id: 'synthtab', descriptor: { name: 'SynthTab Labs' } },
    isActive: true,
    resources: [
      {
        id: 'ds-churn',
        descriptor: { name: 'Customer Churn', shortDesc: 'Synthetic telco churn dataset' },
      },
      {
        id: 'ds-housing',
        descriptor: { name: 'Housing Prices', shortDesc: 'Synthetic housing regression dataset' },
      },
    ],
    offers: [
      {
        id: 'offer-churn-full',
        descriptor: { name: 'Customer Churn — Full (CSV)' },
        resourceIds: ['ds-churn'],
        offerAttributes: datasetItem({
          id: 'ds-churn',
          name: 'Customer Churn',
          description: 'Synthetic telco churn dataset for binary classification.',
          rows: 3000,
          cols: 6,
          dataType: 'TabularCsv',
          resourceKind: 'dataset',
          modality: 'tabular',
          taskType: 'classification',
          licenseClass: 'permissive',
        }),
        validity: { startDate: '2025-01-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z' },
        considerations: [priceConsideration('churn', 0)],
      },
      {
        id: 'offer-housing-full',
        descriptor: { name: 'Housing Prices — Full (CSV)' },
        resourceIds: ['ds-housing'],
        offerAttributes: datasetItem({
          id: 'ds-housing',
          name: 'Housing Prices',
          description: 'Synthetic housing price dataset for regression.',
          rows: 2500,
          cols: 6,
          dataType: 'TabularCsv',
          resourceKind: 'dataset',
          modality: 'tabular',
          taskType: 'regression',
          licenseClass: 'permissive',
        }),
        validity: { startDate: '2025-01-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z' },
        considerations: [priceConsideration('housing', 0)],
      },
    ],
  };
  return {
    catalog,
    files: {
      'offer-churn-full': { full: churnFull, sample: churnSample },
      'offer-housing-full': { full: housingFull },
    },
  };
}

function buildImage(): SeedFile {
  const bppId = 'bpp.vision.local';
  const shapesFull = genShapes('image/shapes.ndjson', 2000, 303);
  const shapesSample = genShapes('image/shapes.sample.ndjson', 40, 303);
  const catalog = {
    id: 'catalog-pixelforge',
    descriptor: { name: 'PixelForge — Image Datasets' },
    bppId,
    bppUri: 'http://localhost:3012',
    provider: { id: 'pixelforge', descriptor: { name: 'PixelForge' } },
    isActive: true,
    resources: [
      { id: 'ds-shapes', descriptor: { name: 'Tiny Shapes', shortDesc: '8x8 grayscale shapes' } },
    ],
    offers: [
      {
        id: 'offer-shapes-full',
        descriptor: { name: 'Tiny Shapes — Full (NDJSON)' },
        resourceIds: ['ds-shapes'],
        offerAttributes: datasetItem({
          id: 'ds-shapes',
          name: 'Tiny Shapes',
          description: 'Synthetic 8x8 grayscale shape images (circle/square/triangle).',
          rows: 2000,
          cols: 64,
          dataType: 'ImageNdjson',
          resourceKind: 'dataset',
          modality: 'image',
          taskType: 'classification',
          licenseClass: 'permissive',
        }),
        validity: { startDate: '2025-01-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z' },
        considerations: [priceConsideration('shapes', 0)],
      },
    ],
  };
  return {
    catalog,
    files: { 'offer-shapes-full': { full: shapesFull, sample: shapesSample } },
  };
}

function buildModels(): SeedFile {
  const bppId = 'bpp.models.local';
  const logreg = genLogRegModel(
    'models/churn-logreg.json',
    ['age', 'tenure_months', 'monthly_charges'],
    404,
  );
  const mlp = genTinyMlp('models/shapes-mlp.json', 505);
  const catalog = {
    id: 'catalog-tinymodels',
    descriptor: { name: 'TinyModels Co — Pretrained Models' },
    bppId,
    bppUri: 'http://localhost:3022',
    provider: { id: 'tinymodels', descriptor: { name: 'TinyModels Co' } },
    isActive: true,
    resources: [
      {
        id: 'model-churn-logreg',
        descriptor: { name: 'Churn LogReg', shortDesc: 'Logistic regression churn model' },
      },
      {
        id: 'model-shapes-mlp',
        descriptor: { name: 'Shapes MLP', shortDesc: '2-layer MLP shape classifier' },
      },
    ],
    offers: [
      {
        id: 'offer-churn-logreg',
        descriptor: { name: 'Churn LogReg — Weights (JSON)' },
        resourceIds: ['model-churn-logreg'],
        offerAttributes: datasetItem({
          id: 'model-churn-logreg',
          name: 'Churn LogReg',
          description: 'Pretrained logistic-regression churn classifier weights.',
          rows: 0,
          cols: 3,
          dataType: 'PretrainedModel',
          resourceKind: 'model',
          modality: 'tabular',
          taskType: 'classification',
          licenseClass: 'permissive',
        }),
        validity: { startDate: '2025-01-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z' },
        considerations: [priceConsideration('logreg', 0)],
      },
      {
        id: 'offer-shapes-mlp',
        descriptor: { name: 'Shapes MLP — Weights (JSON)' },
        resourceIds: ['model-shapes-mlp'],
        offerAttributes: datasetItem({
          id: 'model-shapes-mlp',
          name: 'Shapes MLP',
          description: 'Pretrained 2-layer MLP shape classifier weights.',
          rows: 0,
          cols: 0,
          dataType: 'PretrainedModel',
          resourceKind: 'model',
          modality: 'image',
          taskType: 'classification',
          licenseClass: 'research-only',
        }),
        validity: { startDate: '2025-01-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z' },
        considerations: [priceConsideration('mlp', 0)],
      },
    ],
  };
  return {
    catalog,
    files: {
      'offer-churn-logreg': { full: logreg },
      'offer-shapes-mlp': { full: mlp },
    },
  };
}

function writeSeed(name: string, seed: SeedFile): void {
  // Dogfood our own schema: the catalog must validate before we ship it.
  Catalog.parse(seed.catalog);
  mkdirSync(CATALOGS_DIR, { recursive: true });
  writeFileSync(resolve(CATALOGS_DIR, `${name}.catalog.json`), JSON.stringify(seed, null, 2));
  const offerCount = (seed.catalog as { offers: unknown[] }).offers.length;
  console.log(`  ${name}.catalog.json — ${offerCount} offers, files ok`);
}

function main(): void {
  console.log('Generating synthetic seed catalogs + files...');
  writeSeed('tabular', buildTabular());
  writeSeed('image', buildImage());
  writeSeed('models', buildModels());
  console.log(`Done. Catalogs -> ${CATALOGS_DIR}, files -> ${FILES_DIR}`);
}

main();
