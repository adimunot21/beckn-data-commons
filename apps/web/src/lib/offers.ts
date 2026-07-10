/**
 * Flatten a BAP search response's catalogs into addressable offers — a lean port
 * of services/mcp-server/src/session.ts's recordSearch, minus the session state
 * (the web client holds state in the browser instead).
 */
import type { Json, SearchResponse } from './bdc';

export interface OfferRef {
  offerId: string;
  bppId: string;
  bppUri: string;
  resourceId: string;
  name: string;
  description?: string;
  kind?: string;
  modality?: string;
  taskType?: string;
  licenseClass?: string;
  rowCount?: number;
  columnCount?: number;
  attributes: Json;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

export function flattenOffers(resp: SearchResponse): OfferRef[] {
  const found: OfferRef[] = [];
  for (const catalog of resp.catalogs) {
    const bppId = str(catalog.bppId) ?? '';
    const bppUri = str(catalog.bppUri) ?? '';
    for (const offer of (catalog.offers as Json[] | undefined) ?? []) {
      const a = (offer.offerAttributes as Json | undefined) ?? {};
      const ref: OfferRef = {
        offerId: str(offer.id) ?? '',
        bppId,
        bppUri,
        resourceId: ((offer.resourceIds as string[] | undefined) ?? [])[0] ?? '',
        name:
          str((offer.descriptor as Json | undefined)?.name) ??
          str(a['schema:name']) ??
          String(offer.id ?? ''),
        description: str(a['schema:description']),
        kind: str(a['bdc:resourceKind']),
        modality: str(a['bdc:modality']),
        taskType: str(a['bdc:taskType']),
        licenseClass: str(a['bdc:licenseClass']),
        rowCount: num(a['dataset:rowCountEstimate']),
        columnCount: num(a['dataset:columnCount']),
        attributes: a,
      };
      if (ref.offerId) found.push(ref);
    }
  }
  return found;
}
