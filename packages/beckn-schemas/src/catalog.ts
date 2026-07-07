/**
 * `on_discover` catalog schemas, aligned to the official Beckn DDM
 * (github.com/beckn/DDM) `DatasetItem` — verified against captured payloads
 * (docs/data-contract.md §2). Every object is `.passthrough()` because both DDM
 * schemas set `additionalProperties: true`: we validate the fields we depend on
 * and carry the rest through untouched for interop.
 */
import { z } from 'zod';

export const Descriptor = z
  .object({
    name: z.string(),
    shortDesc: z.string().optional(),
    longDesc: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();
export type Descriptor = z.infer<typeof Descriptor>;

/** A dataset/model resource within a catalog. */
export const Resource = z
  .object({
    id: z.string(),
    descriptor: Descriptor,
  })
  .passthrough();
export type Resource = z.infer<typeof Resource>;

/**
 * `offerAttributes` = DDM `DatasetItem` (JSON-LD, schema.org + `dataset:` ext).
 * Required per the DDM schema: identifier, name, temporalCoverage. The rest are
 * optional and passthrough carries everything else (spatialCoverage, quality
 * flags, streamMeta, …).
 */
export const DatasetItemAttributes = z
  .object({
    '@context': z.union([z.string(), z.array(z.string())]).optional(),
    '@type': z.literal('DatasetItem'),
    'schema:identifier': z.string(),
    'schema:name': z.string(),
    'schema:description': z.string().optional(),
    'schema:temporalCoverage': z.string(),
    'schema:license': z.union([z.string(), z.record(z.unknown())]).optional(),
    'schema:conditionsOfAccess': z.union([z.string(), z.record(z.unknown())]).optional(),
    'dataset:accessMethod': z.string().optional(),
    'dataset:rowCountEstimate': z.number().int().nonnegative().optional(),
    'dataset:columnCount': z.number().int().nonnegative().optional(),
    'dataset:dataType': z.string().optional(),
    'dataset:refreshType': z.string().optional(),
    'dataset:granularity': z.string().optional(),
    'dataset:sensitivityLevel': z.string().optional(),
  })
  .passthrough();
export type DatasetItemAttributes = z.infer<typeof DatasetItemAttributes>;

/** DDM PriceSpecification (offer consideration). */
export const PriceSpecification = z
  .object({
    '@type': z.string().optional(),
    currency: z.string(),
    value: z.number(),
    components: z.array(z.record(z.unknown())).optional(),
  })
  .passthrough();
export type PriceSpecification = z.infer<typeof PriceSpecification>;

export const Consideration = z
  .object({
    id: z.string(),
    status: z.object({ code: z.string() }).passthrough().optional(),
    considerationAttributes: PriceSpecification,
  })
  .passthrough();
export type Consideration = z.infer<typeof Consideration>;

export const Validity = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
  })
  .passthrough();
export type Validity = z.infer<typeof Validity>;

/** An offer over one or more resources — how you actually get access. */
export const Offer = z
  .object({
    id: z.string(),
    descriptor: Descriptor,
    resourceIds: z.array(z.string()),
    offerAttributes: DatasetItemAttributes,
    validity: Validity.optional(),
    considerations: z.array(Consideration).optional(),
  })
  .passthrough();
export type Offer = z.infer<typeof Offer>;

export const Provider = z
  .object({
    id: z.string(),
    descriptor: Descriptor,
  })
  .passthrough();
export type Provider = z.infer<typeof Provider>;

export const Catalog = z
  .object({
    id: z.string(),
    descriptor: Descriptor,
    bppId: z.string().optional(),
    bppUri: z.string().url().optional(),
    provider: Provider,
    isActive: z.boolean().optional(),
    resources: z.array(Resource),
    offers: z.array(Offer),
  })
  .passthrough();
export type Catalog = z.infer<typeof Catalog>;

/** `message` payload of an `on_discover` callback. */
export const OnDiscoverMessage = z.object({ catalogs: z.array(Catalog) });
export type OnDiscoverMessage = z.infer<typeof OnDiscoverMessage>;
