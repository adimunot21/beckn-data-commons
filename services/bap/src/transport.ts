/**
 * Outbound transport for the BAP: sending Beckn requests to BPPs, and calling the
 * Access Manager to issue grants. Both are interfaces so the orchestrator can be
 * tested with a fake BPP (that drives callbacks) and a fake AM.
 */
import type { IssueGrantRequest, SignedAccessGrant } from '@bdc/beckn-schemas';

/** Sends a Beckn request (discover/select/init/confirm) to a BPP endpoint. */
export interface BppTransport {
  /** POST `${uri}/${action}` with the envelope; resolves once the ACK is received. */
  send(
    uri: string,
    action: string,
    envelope: unknown,
    headers?: Record<string, string>,
  ): Promise<void>;
}

/** Calls the Access Manager to issue a grant. */
export interface AmClient {
  issue(request: IssueGrantRequest): Promise<SignedAccessGrant>;
}

export const httpBppTransport: BppTransport = {
  async send(uri, action, envelope, headers) {
    const res = await fetch(`${uri.replace(/\/$/, '')}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(envelope),
    });
    if (!res.ok) {
      throw new Error(`BPP ${uri} rejected ${action}: HTTP ${res.status}`);
    }
  },
};

/**
 * AM client. `sign` (when provided) authenticates the issue request as the BAP so
 * the Access Manager only mints grants for a trusted requester — no rogue issuance.
 */
export function httpAmClient(
  accessManagerUrl: string,
  sign?: (body: unknown) => Promise<string>,
): AmClient {
  return {
    async issue(request) {
      const authorization = sign ? await sign(request) : undefined;
      const res = await fetch(`${accessManagerUrl}/grants`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        throw new Error(`Access Manager refused to issue grant: HTTP ${res.status}`);
      }
      return (await res.json()) as SignedAccessGrant;
    },
  };
}
