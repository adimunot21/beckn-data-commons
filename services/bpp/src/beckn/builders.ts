/**
 * Pure builders for the BPP's Beckn callbacks. No I/O — given a request context,
 * the catalog, and the request message, produce the `on_<action>` envelope. Kept
 * pure so they are exhaustively unit-testable without a running server.
 *
 * DDM contract lifecycle (verified in docs/data-contract.md §3):
 *   on_select  -> contract DRAFT
 *   on_init    -> contract ACTIVE
 *   on_confirm -> contract ACTIVE + performance (DatasetFulfillment access)
 */
import { SearchIntent, type BecknContext } from '@bdc/beckn-schemas';
import type { BppCatalog } from '../catalog.js';

export interface ResponderIdentity {
  bppId: string;
  bppUri: string;
}

export interface BuildDeps {
  responder: ResponderIdentity;
  /** Current time as ISO-8601 (injected for determinism). */
  nowIso: string;
}

type Json = Record<string, unknown>;

function responseContext(req: BecknContext, action: string, deps: BuildDeps): Json {
  return {
    ...req,
    action,
    bppId: deps.responder.bppId,
    bppUri: deps.responder.bppUri,
    timestamp: deps.nowIso,
  };
}

/** Best-effort extraction of a normalized SearchIntent from a discover message. */
export function extractIntent(message: unknown): SearchIntent {
  const m = (message ?? {}) as Json;
  const intent = (m.intent ?? {}) as Json;
  const descriptorName =
    ((intent.descriptor as Json | undefined)?.name as string | undefined) ?? undefined;
  const candidate: Json = {
    kind: intent.kind,
    modality: intent.modality,
    taskType: intent.taskType,
    licenseClass: intent.licenseClass,
    minRows: intent.minRows,
    query: (intent.query as string | undefined) ?? descriptorName,
    purpose: intent.purpose,
  };
  // Drop undefined keys, then validate leniently (unknown enum values -> ignored field).
  for (const k of Object.keys(candidate)) if (candidate[k] === undefined) delete candidate[k];
  const parsed = SearchIntent.safeParse(candidate);
  return parsed.success ? parsed.data : {};
}

/** Extract the referenced offer id from a select/init/confirm message. */
export function extractOfferId(message: unknown): string | undefined {
  const m = (message ?? {}) as Json;
  const fromContract = (m.contract as Json | undefined)?.offers as Json[] | undefined;
  const fromOrder = (m.order as Json | undefined)?.offers as Json[] | undefined;
  return (
    (fromContract?.[0]?.id as string | undefined) ??
    (fromOrder?.[0]?.id as string | undefined) ??
    (m.offerId as string | undefined)
  );
}

export function buildOnDiscover(
  req: BecknContext,
  catalog: BppCatalog,
  message: unknown,
  deps: BuildDeps,
): { context: Json; message: Json } {
  const intent = extractIntent(message);
  const filtered = catalog.search(intent);
  const catalogs = filtered.offers.length > 0 ? [filtered] : [];
  return { context: responseContext(req, 'on_discover', deps), message: { catalogs } };
}

function baseContract(
  req: BecknContext,
  offerId: string,
  statusCode: string,
  catalog: BppCatalog,
): Json {
  const offer = catalog.getOffer(offerId);
  return {
    id: `contract-${req.transactionId}`,
    descriptor: { name: offer?.descriptor.name ?? 'Data access contract' },
    status: { code: statusCode },
    participants: [
      { role: 'BAP', id: req.bapId },
      { role: 'BPP', id: catalog.catalog.bppId },
    ],
    commitments: offer ? [{ id: `commitment-${offerId}`, offerId }] : [],
    consideration: offer?.considerations?.[0] ?? null,
  };
}

export function buildOnSelect(
  req: BecknContext,
  catalog: BppCatalog,
  message: unknown,
  deps: BuildDeps,
): { context: Json; message: Json } {
  const offerId = extractOfferId(message) ?? '';
  return {
    context: responseContext(req, 'on_select', deps),
    message: { contract: baseContract(req, offerId, 'DRAFT', catalog) },
  };
}

export function buildOnInit(
  req: BecknContext,
  catalog: BppCatalog,
  message: unknown,
  deps: BuildDeps,
): { context: Json; message: Json } {
  const offerId = extractOfferId(message) ?? '';
  return {
    context: responseContext(req, 'on_init', deps),
    message: { contract: baseContract(req, offerId, 'ACTIVE', catalog) },
  };
}

/**
 * on_confirm carries the DatasetFulfillment. Note: `accessUrl` points at THIS
 * BPP's grant-gated download endpoint — access still requires presenting a valid
 * Access Grant (issued by the Access Manager, Phase 4). This is the deliberate
 * upgrade over DDM's bare bearer URL.
 */
export function buildOnConfirm(
  req: BecknContext,
  catalog: BppCatalog,
  message: unknown,
  deps: BuildDeps,
): { context: Json; message: Json } {
  const offerId = extractOfferId(message) ?? '';
  const offer = catalog.getOffer(offerId);
  const resourceId = offer?.resourceIds[0] ?? '';
  const contract = baseContract(req, offerId, 'ACTIVE', catalog);
  const downloadUrl = `${deps.responder.bppUri}/download?offerId=${encodeURIComponent(
    offerId,
  )}&resourceId=${encodeURIComponent(resourceId)}`;

  contract.performance = [
    {
      id: `ffl-${req.transactionId}`,
      status: { code: 'PENDING' },
      commitmentIds: [`commitment-${offerId}`],
      performanceAttributes: {
        '@type': 'DatasetFulfillment',
        'fulfillment:accessMethod': 'DOWNLOAD',
        'fulfillment:accessUrl': downloadUrl,
        // Access requires a signed Access Grant presented to accessUrl.
        'bdc:requiresGrant': true,
        'bdc:grantResource': { resourceId, offerId },
      },
    },
  ];
  return { context: responseContext(req, 'on_confirm', deps), message: { contract } };
}
