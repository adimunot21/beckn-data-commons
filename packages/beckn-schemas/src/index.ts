/**
 * @bdc/beckn-schemas
 *
 * Shared Zod schemas for Beckn Data Commons:
 * - BDC domain vocabulary we own (./domain)
 * - Beckn v2.0.0 context/envelope/ACK, verified against real payloads (./context)
 * - DDM-aligned catalog / on_discover (./catalog)
 * - DDM-aligned contract lifecycle / DatasetFulfillment (./contract)
 * - The Access Grant consent artifact — our novel contribution (./grant)
 */
export * from './domain.js';
export * from './context.js';
export * from './catalog.js';
export * from './contract.js';
export * from './grant.js';
