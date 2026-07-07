/**
 * @bdc/beckn-schemas
 *
 * Shared Zod schemas for Beckn Data Commons.
 *
 * Scope note: this package currently defines only the BDC *domain vocabulary* we
 * own outright (resource kinds, license classes). The Beckn wire-format schemas
 * (context/message envelopes, on_search catalogs, etc.) are intentionally NOT
 * defined from the spec here — they are built in Phase 2 against a REAL Fabric
 * response captured in Phase 1, per the project's "inspect before integrating"
 * rule. Do not add spec-derived Beckn schemas until that inspection is done.
 */

import { z } from 'zod';

/** What a catalog entry actually is. */
export const ResourceKind = z.enum(['dataset', 'model']);
export type ResourceKind = z.infer<typeof ResourceKind>;

/**
 * License class governs redistribution rights. Deliberately coarse — the point
 * of the project is the consent/grant mechanics, not a full SPDX taxonomy.
 */
export const LicenseClass = z.enum(['permissive', 'research-only', 'no-redistribution']);
export type LicenseClass = z.infer<typeof LicenseClass>;
