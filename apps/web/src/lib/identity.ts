'use client';

/**
 * Sandbox identity + held grants, stored in the browser. Wave 1 deliberately has
 * no accounts: the console works against a per-browser grantee id, and the signed
 * grants you obtain are held client-side (you literally hold the consent
 * artifact). Org accounts + API keys replace this in Wave 2 (docs/PRODUCT.md §9).
 */
import type { SignedAccessGrant } from '@bdc/beckn-schemas';

const GRANTEE_KEY = 'bdc.grantee';
const GRANTS_KEY = 'bdc.grants';

export interface HeldGrant {
  grant: SignedAccessGrant;
  accessUrl: string;
  name: string;
  obtainedAt: string;
}

export function getGranteeId(): string {
  if (typeof window === 'undefined') return 'web-ssr';
  let id = window.localStorage.getItem(GRANTEE_KEY);
  if (!id) {
    id = `web-${crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem(GRANTEE_KEY, id);
  }
  return id;
}

export function listHeldGrants(): HeldGrant[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(GRANTS_KEY) ?? '[]') as HeldGrant[];
  } catch {
    return [];
  }
}

export function addHeldGrant(held: HeldGrant): void {
  const all = listHeldGrants().filter((g) => g.grant.claims.grantId !== held.grant.claims.grantId);
  all.unshift(held);
  window.localStorage.setItem(GRANTS_KEY, JSON.stringify(all.slice(0, 50)));
}
