/**
 * Contract lifecycle schemas for `on_select` / `on_init` / `on_confirm`, aligned
 * to Beckn DDM. Verified against captured payloads (docs/data-contract.md §3):
 * the `contract` accretes DRAFT -> ACTIVE, and access (`performance` /
 * `DatasetFulfillment`) appears only at `on_confirm`.
 *
 * NOTE: `DatasetFulfillment.fulfillment:accessUrl` is DDM's bare bearer-URL
 * access model. Our BDC extension replaces that trust model with a signed
 * Access Grant (see ./grant.ts) while staying wire-compatible with this envelope.
 */
import { z } from 'zod';
import { Descriptor } from './catalog.js';

/** Observed contract states (DRAFT at select, ACTIVE at init/confirm). */
export const ContractStatusCode = z.enum(['DRAFT', 'ACTIVE', 'COMPLETE', 'CANCELLED']);
export type ContractStatusCode = z.infer<typeof ContractStatusCode>;

/** DDM `DatasetFulfillment` — access provisioning, present at on_confirm. */
export const DatasetFulfillmentAttributes = z
  .object({
    '@context': z.string().optional(),
    '@type': z.string(),
    'fulfillment:accessMethod': z.string(),
    'fulfillment:accessUrl': z.string().optional(),
    'fulfillment:accessStart': z.string().optional(),
    'fulfillment:accessEnd': z.string().optional(),
    'fulfillment:format': z.string().optional(),
    'fulfillment:fileSizeBytes': z.number().int().nonnegative().optional(),
    'fulfillment:maxDownloads': z.number().int().nonnegative().optional(),
    'fulfillment:downloadsUsed': z.number().int().nonnegative().optional(),
  })
  .passthrough();
export type DatasetFulfillmentAttributes = z.infer<typeof DatasetFulfillmentAttributes>;

export const Performance = z
  .object({
    id: z.string(),
    status: z.object({ code: z.string() }).passthrough().optional(),
    commitmentIds: z.array(z.string()).optional(),
    performanceAttributes: DatasetFulfillmentAttributes,
  })
  .passthrough();
export type Performance = z.infer<typeof Performance>;

/**
 * The contract object, spanning select/init/confirm. Only `id` and `status` are
 * reliably present at every stage; the rest accrete, so they are optional and
 * passthrough carries commitments/consideration/participants/settlements as-is.
 */
export const Contract = z
  .object({
    id: z.string(),
    descriptor: Descriptor.optional(),
    status: z.object({ code: z.string() }).passthrough(),
    participants: z.array(z.record(z.unknown())).optional(),
    commitments: z.array(z.record(z.unknown())).optional(),
    consideration: z.unknown().optional(),
    performance: z.array(Performance).optional(),
    settlements: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough();
export type Contract = z.infer<typeof Contract>;

/** `message` payload for on_select / on_init / on_confirm callbacks. */
export const ContractMessage = z.object({ contract: Contract });
export type ContractMessage = z.infer<typeof ContractMessage>;
