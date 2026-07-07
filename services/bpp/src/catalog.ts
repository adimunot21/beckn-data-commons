/**
 * Catalog loading, search, and file resolution for a BPP instance.
 *
 * A seed file is `{ catalog: <Catalog>, files: { <offerId>: {full, sample?} } }`.
 * The catalog is validated against @bdc/beckn-schemas on load (we dogfood our own
 * schema), the `files` map drives grant-gated download resolution.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Catalog, type Catalog as CatalogT, type SearchIntent } from '@bdc/beckn-schemas';
import type { FileResolver, ResolvedFile } from './download.js';

const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv',
  ndjson: 'application/x-ndjson',
  json: 'application/json',
};

function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

interface SeedFile {
  catalog: unknown;
  files: Record<string, { full: string; sample?: string }>;
}

export class BppCatalog {
  private constructor(
    readonly catalog: CatalogT,
    private readonly files: Record<string, { full: string; sample?: string }>,
    private readonly dataDir: string,
  ) {}

  static load(catalogFile: string, dataDir: string): BppCatalog {
    const raw = JSON.parse(readFileSync(catalogFile, 'utf-8')) as SeedFile;
    const catalog = Catalog.parse(raw.catalog);
    return new BppCatalog(catalog, raw.files ?? {}, dataDir);
  }

  /** Look up an offer by id. */
  getOffer(offerId: string): CatalogT['offers'][number] | undefined {
    return this.catalog.offers.find((o) => o.id === offerId);
  }

  /**
   * Return a copy of the catalog containing only offers matching the intent (and
   * only the resources those offers cover). An empty/absent intent matches all.
   */
  search(intent: SearchIntent = {}): CatalogT {
    const offers = this.catalog.offers.filter((o) => this.matches(o, intent));
    const keptResourceIds = new Set(offers.flatMap((o) => o.resourceIds));
    return {
      ...this.catalog,
      offers,
      resources: this.catalog.resources.filter((r) => keptResourceIds.has(r.id)),
    };
  }

  private matches(offer: CatalogT['offers'][number], intent: SearchIntent): boolean {
    const a = offer.offerAttributes as Record<string, unknown>;
    const eq = (field: string, want?: string) => want === undefined || a[field] === want;

    if (!eq('bdc:resourceKind', intent.kind)) return false;
    if (!eq('bdc:modality', intent.modality)) return false;
    if (!eq('bdc:taskType', intent.taskType)) return false;
    if (!eq('bdc:licenseClass', intent.licenseClass)) return false;

    if (intent.minRows !== undefined) {
      const rows = Number(a['dataset:rowCountEstimate'] ?? 0);
      if (rows < intent.minRows) return false;
    }

    if (intent.query) {
      const hay = [
        offer.descriptor.name,
        String(a['schema:name'] ?? ''),
        String(a['schema:description'] ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(intent.query.toLowerCase())) return false;
    }
    return true;
  }

  /** FileResolver used by the download endpoint. Sample scope prefers a sample file. */
  resolveFile: FileResolver = ({ offerId, scopeKind }): ResolvedFile | undefined => {
    const entry = this.files[offerId];
    if (!entry) return undefined;
    const rel = scopeKind === 'sample' && entry.sample ? entry.sample : entry.full;
    const path = resolve(this.dataDir, rel);
    if (!existsSync(path)) return undefined;
    return { path, filename: rel.split('/').pop() ?? 'download', contentType: contentTypeFor(rel) };
  };
}
