/**
 * Server-side client to the BDC backend (BAP + Access Manager + BPP download).
 * Mirrors services/mcp-server/src/gateway.ts — the web app is just another
 * consumer of the same HTTP APIs, called from Next.js route handlers so the
 * browser never talks to the network directly (no CORS, no key exposure).
 *
 * URLs come from env: in dev they default to the compose stack's published
 * ports; in the production container they point at internal service DNS.
 */
import type { SignedAccessGrant } from '@bdc/beckn-schemas';

export type Json = Record<string, unknown>;

const BAP_URL = (process.env.BAP_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const AM_URL = (process.env.ACCESS_MANAGER_URL ?? 'http://localhost:3003').replace(/\/$/, '');

async function postJson(url: string, body: unknown): Promise<Json> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export interface SearchResponse {
  transactionId: string;
  providers: (string | undefined)[];
  catalogs: Json[];
}

export function search(intent: Json, purpose?: string): Promise<SearchResponse> {
  return postJson(`${BAP_URL}/search`, { intent, purpose }) as unknown as Promise<SearchResponse>;
}

export interface ConfirmParams {
  transactionId: string;
  bppId: string;
  bppUri?: string;
  offerId: string;
  resourceId: string;
  granteeId: string;
  purpose: string;
  licenseClass: string;
  scope?: Json;
}

export interface ConfirmResponse {
  contract: Json;
  grant: SignedAccessGrant;
}

export function confirm(params: ConfirmParams): Promise<ConfirmResponse> {
  const { granteeId, ...rest } = params;
  return postJson(`${BAP_URL}/confirm`, {
    ...rest,
    grantee: { id: granteeId },
  }) as unknown as Promise<ConfirmResponse>;
}

export async function listGrants(granteeId: string): Promise<Json[]> {
  const res = await fetch(`${AM_URL}/grants?grantee=${encodeURIComponent(granteeId)}`, {
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return (json.grants as Json[]) ?? [];
}

export async function revokeGrant(
  grantId: string,
  reason: string,
): Promise<{ httpStatus: number; body: Json }> {
  const res = await fetch(`${AM_URL}/grants/${encodeURIComponent(grantId)}/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
    cache: 'no-store',
  });
  return { httpStatus: res.status, body: (await res.json().catch(() => ({}))) as Json };
}

/** Encode a signed grant for the BPP's `Authorization: Grant <base64url>` header. */
export function encodeGrantHeader(grant: SignedAccessGrant): string {
  return `Grant ${Buffer.from(JSON.stringify(grant), 'utf-8').toString('base64url')}`;
}

export interface DownloadResult {
  ok: boolean;
  httpStatus: number;
  error?: string;
  filename?: string;
  bytes?: number;
  /** First few lines, for on-screen preview. */
  preview?: string;
}

/**
 * Rewrite a public path-routed BPP URL to internal service DNS. In production
 * the contract's accessUrl is `https://PUBLIC_HOST/bpp-tabular/...` (correct for
 * remote clients), but this server sits on the same Docker network as the BPPs —
 * fetching internally avoids hairpinning through the reverse proxy.
 * DOWNLOAD_REWRITE format: `bpp-tabular=http://bpp-tabular:3002,...` (optional).
 */
function rewriteAccessUrl(url: string): string {
  const spec = process.env.DOWNLOAD_REWRITE;
  if (!spec) return url;
  try {
    const parsed = new URL(url);
    const prefix = parsed.pathname.split('/')[1] ?? '';
    for (const pair of spec.split(',')) {
      const [pathPrefix, base] = pair.split('=');
      if (pathPrefix?.trim() === prefix && base) {
        return `${base.trim().replace(/\/$/, '')}${parsed.pathname.slice(prefix.length + 1)}${parsed.search}`;
      }
    }
  } catch {
    /* fall through to the original URL */
  }
  return url;
}

/** Redeem a grant at the provider's download URL; returns a preview, not the file. */
export async function download(url: string, grant: SignedAccessGrant): Promise<DownloadResult> {
  const res = await fetch(rewriteAccessUrl(url), {
    headers: { authorization: encodeGrantHeader(grant) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Json;
    return { ok: false, httpStatus: res.status, error: String(err.error ?? res.statusText) };
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1];
  const body = await res.text();
  return {
    ok: true,
    httpStatus: res.status,
    filename,
    bytes: body.length,
    preview: body.split('\n').slice(0, 6).join('\n'),
  };
}

/** The download URL for a confirmed offer: prefer the contract's accessUrl. */
export function accessUrlFrom(contract: Json, grant: SignedAccessGrant): string {
  const perf = (contract.performance as Json[] | undefined)?.[0];
  const attrs = perf?.performanceAttributes as Json | undefined;
  const fromContract = attrs?.['fulfillment:accessUrl'];
  if (typeof fromContract === 'string') return fromContract;
  const { provider, resource } = grant.claims;
  return `${provider.bppUri.replace(/\/$/, '')}/download?resourceId=${encodeURIComponent(
    resource.resourceId,
  )}${resource.offerId ? `&offerId=${encodeURIComponent(resource.offerId)}` : ''}`;
}
