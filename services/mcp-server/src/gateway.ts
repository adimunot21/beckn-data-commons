/**
 * BdcGateway — the MCP server's client to the BDC backend: the BAP (search /
 * select / init / confirm), the Access Manager (list / revoke), and a BPP's
 * grant-gated download endpoint. An interface so tools can be tested with a fake.
 */
import type { GrantScope, LicenseClass, SignedAccessGrant } from '@bdc/beckn-schemas';

export type Json = Record<string, unknown>;

export interface SearchResponse {
  transactionId: string;
  providers: (string | undefined)[];
  catalogs: Json[];
}

export interface ConfirmParams {
  transactionId: string;
  bppId: string;
  bppUri?: string;
  offerId: string;
  resourceId: string;
  grantee: { id: string; publicKey?: string };
  purpose: string;
  licenseClass: LicenseClass;
  scope?: GrantScope;
}

export interface ConfirmResponse {
  contract: Json;
  grant: SignedAccessGrant;
}

export interface RevokeResult {
  outcome: string;
  httpStatus: number;
}

export interface DownloadResult {
  ok: boolean;
  httpStatus: number;
  contentType?: string;
  filename?: string;
  body?: string;
  error?: string;
}

export interface BdcGateway {
  search(intent: Json, purpose?: string): Promise<SearchResponse>;
  select(transactionId: string, bppId: string, offerId: string): Promise<Json>;
  init(transactionId: string, bppId: string, offerId: string): Promise<Json>;
  confirm(params: ConfirmParams): Promise<ConfirmResponse>;
  listGrants(granteeId: string): Promise<Json[]>;
  revokeGrant(grantId: string, reason: string): Promise<RevokeResult>;
  download(url: string, grant: SignedAccessGrant): Promise<DownloadResult>;
}

export interface HttpGatewayDeps {
  bapUrl: string;
  amUrl: string;
  fetchImpl?: typeof fetch;
}

/** Encode a signed grant for the BPP's `Authorization: Grant <base64url>` header. */
export function encodeGrantHeader(grant: SignedAccessGrant): string {
  return `Grant ${Buffer.from(JSON.stringify(grant), 'utf-8').toString('base64url')}`;
}

export class HttpBdcGateway implements BdcGateway {
  private readonly bapUrl: string;
  private readonly amUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(deps: HttpGatewayDeps) {
    this.bapUrl = deps.bapUrl.replace(/\/$/, '');
    this.amUrl = deps.amUrl.replace(/\/$/, '');
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  private async postJson(url: string, body: unknown): Promise<Json> {
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) {
      throw new Error(`${url} -> HTTP ${res.status}: ${JSON.stringify(json)}`);
    }
    return json;
  }

  async search(intent: Json, purpose?: string): Promise<SearchResponse> {
    return (await this.postJson(`${this.bapUrl}/search`, {
      intent,
      purpose,
    })) as unknown as SearchResponse;
  }

  async select(transactionId: string, bppId: string, offerId: string): Promise<Json> {
    const r = await this.postJson(`${this.bapUrl}/select`, { transactionId, bppId, offerId });
    return (r.contract as Json) ?? {};
  }

  async init(transactionId: string, bppId: string, offerId: string): Promise<Json> {
    const r = await this.postJson(`${this.bapUrl}/init`, { transactionId, bppId, offerId });
    return (r.contract as Json) ?? {};
  }

  async confirm(params: ConfirmParams): Promise<ConfirmResponse> {
    return (await this.postJson(`${this.bapUrl}/confirm`, params)) as unknown as ConfirmResponse;
  }

  async listGrants(granteeId: string): Promise<Json[]> {
    const res = await this.fetchImpl(
      `${this.amUrl}/grants?grantee=${encodeURIComponent(granteeId)}`,
    );
    const json = (await res.json().catch(() => ({}))) as Json;
    return (json.grants as Json[]) ?? [];
  }

  async revokeGrant(grantId: string, reason: string): Promise<RevokeResult> {
    const res = await this.fetchImpl(`${this.amUrl}/grants/${encodeURIComponent(grantId)}/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = (await res.json().catch(() => ({}))) as Json;
    return {
      outcome: String(json.outcome ?? json.error ?? res.statusText),
      httpStatus: res.status,
    };
  }

  async download(url: string, grant: SignedAccessGrant): Promise<DownloadResult> {
    const res = await this.fetchImpl(url, { headers: { authorization: encodeGrantHeader(grant) } });
    const contentType = res.headers.get('content-type') ?? undefined;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Json;
      return { ok: false, httpStatus: res.status, error: String(err.error ?? res.statusText) };
    }
    const disposition = res.headers.get('content-disposition') ?? '';
    const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1];
    return {
      ok: true,
      httpStatus: res.status,
      contentType,
      filename,
      body: await res.text(),
    };
  }
}
