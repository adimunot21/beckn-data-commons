/**
 * BDC domain vocabulary — the terms we own outright and use for search intent,
 * catalog classification, and grant scoping. These are coarse on purpose: the
 * project is about consent/transport mechanics, not an exhaustive taxonomy.
 *
 * On the wire we keep the official Beckn DDM `DatasetItem` fields (see
 * ./catalog.ts); these enums are our normalized, enforceable overlay used for
 * filtering and for scoping Access Grants.
 */
import { z } from 'zod';

/** What a catalog entry actually is. */
export const ResourceKind = z.enum(['dataset', 'model']);
export type ResourceKind = z.infer<typeof ResourceKind>;

/**
 * License class governs redistribution rights — a normalized overlay on top of
 * DDM's free-form `schema:license` URL + `schema:conditionsOfAccess`.
 */
export const LicenseClass = z.enum(['permissive', 'research-only', 'no-redistribution']);
export type LicenseClass = z.infer<typeof LicenseClass>;

/** Data modality — the primary search filter for datasets. */
export const Modality = z.enum([
  'tabular',
  'text',
  'image',
  'audio',
  'timeseries',
  'geospatial',
  'multimodal',
]);
export type Modality = z.infer<typeof Modality>;

/** ML task the resource targets — search filter and catalog tag. */
export const TaskType = z.enum([
  'classification',
  'regression',
  'forecasting',
  'clustering',
  'generation',
  'detection',
  'segmentation',
  'recommendation',
  'other',
]);
export type TaskType = z.infer<typeof TaskType>;

/**
 * Normalized search intent — the target structure our MCP/NLU layer produces
 * from a natural-language request, before it is rendered into a Beckn `discover`
 * message. Kept minimal and all-optional so partial intents are valid.
 */
export const SearchIntent = z
  .object({
    kind: ResourceKind.optional(),
    modality: Modality.optional(),
    taskType: TaskType.optional(),
    licenseClass: LicenseClass.optional(),
    /** Free-text query, e.g. "churn prediction". */
    query: z.string().optional(),
    /** Minimum rows for a dataset (maps to DDM dataset:rowCountEstimate). */
    minRows: z.number().int().positive().optional(),
    /** Stated purpose of access — carried into the Access Grant. */
    purpose: z.string().optional(),
  })
  .strict();
export type SearchIntent = z.infer<typeof SearchIntent>;
