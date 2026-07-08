/**
 * Per-connection MCP session state. The MCP server is one process per client, so
 * in-memory state is correct: it remembers the offers from the last search (so a
 * follow-up tool can reference an offerId) and the grants it has obtained (so
 * download/revoke can act on them).
 */
import { LicenseClass, type SignedAccessGrant } from '@bdc/beckn-schemas';
import type { Json, SearchResponse } from './gateway.js';

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
  licenseClass?: LicenseClass;
  rowCount?: number;
  columnCount?: number;
  attributes: Json;
}

export interface GrantRef {
  grantId: string;
  signedGrant: SignedAccessGrant;
  offerId: string;
  resourceId: string;
  bppUri: string;
  accessUrl?: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

export class BdcSession {
  lastTransactionId: string | undefined;
  private readonly offers = new Map<string, OfferRef>();
  private readonly grants = new Map<string, GrantRef>();

  /** Flatten a search response into offer refs, keyed by offerId. Returns them. */
  recordSearch(resp: SearchResponse): OfferRef[] {
    this.lastTransactionId = resp.transactionId;
    const found: OfferRef[] = [];
    for (const catalog of resp.catalogs) {
      const bppId = str(catalog.bppId) ?? '';
      const bppUri = str(catalog.bppUri) ?? '';
      const offers = (catalog.offers as Json[] | undefined) ?? [];
      for (const offer of offers) {
        const a = (offer.offerAttributes as Json | undefined) ?? {};
        const licenseClass = LicenseClass.safeParse(a['bdc:licenseClass']);
        const ref: OfferRef = {
          offerId: str(offer.id) ?? '',
          bppId,
          bppUri,
          resourceId: ((offer.resourceIds as string[] | undefined) ?? [])[0] ?? '',
          name:
            str((offer.descriptor as Json | undefined)?.name) ??
            str(a['schema:name']) ??
            offer.id + '',
          description: str(a['schema:description']),
          kind: str(a['bdc:resourceKind']),
          modality: str(a['bdc:modality']),
          taskType: str(a['bdc:taskType']),
          licenseClass: licenseClass.success ? licenseClass.data : undefined,
          rowCount: num(a['dataset:rowCountEstimate']),
          columnCount: num(a['dataset:columnCount']),
          attributes: a,
        };
        if (ref.offerId) {
          this.offers.set(ref.offerId, ref);
          found.push(ref);
        }
      }
    }
    return found;
  }

  getOffer(offerId: string): OfferRef | undefined {
    return this.offers.get(offerId);
  }

  listOffers(): OfferRef[] {
    return [...this.offers.values()];
  }

  recordGrant(ref: GrantRef): void {
    this.grants.set(ref.grantId, ref);
  }

  getGrant(grantId: string): GrantRef | undefined {
    return this.grants.get(grantId);
  }

  /** Most recently obtained grant for an offer (download without a grantId). */
  latestGrantForOffer(offerId: string): GrantRef | undefined {
    let latest: GrantRef | undefined;
    for (const g of this.grants.values()) if (g.offerId === offerId) latest = g;
    return latest;
  }

  listGrantRefs(): GrantRef[] {
    return [...this.grants.values()];
  }
}
