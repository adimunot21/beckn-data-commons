/**
 * The BDC MCP server: seven tools that let any MCP client (Claude) drive the full
 * Beckn Data Commons flow in natural language —
 *   search_resources -> view_resource -> request_access -> confirm_access ->
 *   download, plus list_my_grants / revoke_grant.
 *
 * Tools are thin: they translate arguments into gateway calls and format results.
 * The gateway (BAP/AM/BPP client) and session are injected so this is testable
 * with a fake backend over an in-memory transport.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ResourceKind, Modality, TaskType, LicenseClass, GrantScopeKind } from '@bdc/beckn-schemas';
import type { McpConfig } from './config.js';
import type { BdcGateway, Json } from './gateway.js';
import { BdcSession, type OfferRef } from './session.js';

export interface ServerDeps {
  config: McpConfig;
  gateway: BdcGateway;
  session?: BdcSession;
}

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

const ok = (text: string): ToolResult => ({ content: [{ type: 'text', text }] });
const fail = (text: string): ToolResult => ({ content: [{ type: 'text', text }], isError: true });

function offerLine(o: OfferRef): string {
  const bits = [
    o.kind,
    o.modality,
    o.rowCount !== undefined ? `${o.rowCount} rows` : undefined,
    o.licenseClass ? `license:${o.licenseClass}` : undefined,
  ].filter(Boolean);
  return `• ${o.offerId} — ${o.name} [${bits.join(', ')}] from ${o.bppId}`;
}

function contractStatus(contract: Json): string {
  const status = (contract.status as Json | undefined)?.code;
  return typeof status === 'string' ? status : 'unknown';
}

function accessUrlFromContract(contract: Json): string | undefined {
  const perf = (contract.performance as Json[] | undefined)?.[0];
  const attrs = perf?.performanceAttributes as Json | undefined;
  const url = attrs?.['fulfillment:accessUrl'];
  return typeof url === 'string' ? url : undefined;
}

export function createServer(deps: ServerDeps): McpServer {
  const { config, gateway } = deps;
  const session = deps.session ?? new BdcSession();

  const server = new McpServer({ name: 'beckn-data-commons', version: '0.1.0' });

  server.registerTool(
    'search_resources',
    {
      title: 'Search datasets & models',
      description:
        'Discover ML datasets/models across the Beckn Data Commons network by task, modality, ' +
        'license, minimum rows, or free text. Returns offers you can then view, request, and download.',
      inputSchema: {
        query: z.string().optional().describe('free-text, e.g. "churn prediction"'),
        kind: ResourceKind.optional().describe('dataset or model'),
        modality: Modality.optional(),
        taskType: TaskType.optional(),
        licenseClass: LicenseClass.optional(),
        minRows: z.number().int().positive().optional().describe('minimum dataset rows'),
        purpose: z.string().optional().describe('why you want the data (recorded in the grant)'),
      },
    },
    async (args) => {
      const intent: Json = {};
      for (const k of [
        'query',
        'kind',
        'modality',
        'taskType',
        'licenseClass',
        'minRows',
      ] as const) {
        if (args[k] !== undefined) intent[k] = args[k];
      }
      const resp = await gateway.search(intent, args.purpose);
      const offers = session.recordSearch(resp);
      if (offers.length === 0) {
        return ok('No matching resources found. Try broadening the query or removing filters.');
      }
      return ok(
        `Found ${offers.length} resource(s):\n\n${offers.map(offerLine).join('\n')}\n\n` +
          'Use view_resource for details, then confirm_access to obtain a signed Access Grant.',
      );
    },
  );

  server.registerTool(
    'view_resource',
    {
      title: 'View resource details',
      description: 'Show the full catalog metadata for one offer from the last search.',
      inputSchema: { offerId: z.string().describe('an offerId from search_resources') },
    },
    async ({ offerId }) => {
      const o = session.getOffer(offerId);
      if (!o) return fail(`Unknown offerId "${offerId}". Run search_resources first.`);
      return ok(
        `${o.name} (${o.offerId})\n${o.description ?? ''}\n` +
          `kind: ${o.kind}, modality: ${o.modality}, task: ${o.taskType}\n` +
          `rows: ${o.rowCount ?? '?'}, columns: ${o.columnCount ?? '?'}\n` +
          `license class: ${o.licenseClass ?? 'unknown'}\nprovider: ${o.bppId}\n\n` +
          `Full metadata:\n${JSON.stringify(o.attributes, null, 2)}`,
      );
    },
  );

  server.registerTool(
    'request_access',
    {
      title: 'Request access (negotiate terms)',
      description:
        'Run the Beckn select+init negotiation for an offer to preview the draft contract/terms ' +
        'before confirming. Optional — confirm_access can be called directly.',
      inputSchema: { offerId: z.string() },
    },
    async ({ offerId }) => {
      const o = session.getOffer(offerId);
      if (!o) return fail(`Unknown offerId "${offerId}". Run search_resources first.`);
      if (!session.lastTransactionId) return fail('Run search_resources first.');
      const draft = await gateway.select(session.lastTransactionId, o.bppId, offerId);
      const active = await gateway.init(session.lastTransactionId, o.bppId, offerId);
      return ok(
        `Access negotiation for ${o.name}:\n` +
          `- select -> contract ${contractStatus(draft)}\n` +
          `- init   -> contract ${contractStatus(active)}\n\n` +
          'Ready. Call confirm_access with a stated purpose to obtain a signed Access Grant.',
      );
    },
  );

  server.registerTool(
    'confirm_access',
    {
      title: 'Confirm & obtain an Access Grant',
      description:
        'Confirm the transaction and obtain a signed, scoped, revocable Access Grant from the ' +
        'Access Manager. Required before download.',
      inputSchema: {
        offerId: z.string(),
        purpose: z.string().describe('stated purpose of access (bound into the grant)'),
        scope: GrantScopeKind.optional().describe('full (default), sample, or subset'),
        fields: z.array(z.string()).optional().describe('for subset scope: the authorized fields'),
      },
    },
    async ({ offerId, purpose, scope, fields }) => {
      const o = session.getOffer(offerId);
      if (!o) return fail(`Unknown offerId "${offerId}". Run search_resources first.`);
      if (!session.lastTransactionId) return fail('Run search_resources first.');
      if (!o.licenseClass)
        return fail(`Offer ${offerId} has no known license class; cannot issue a grant.`);
      const grantScope = scope
        ? { kind: scope, ...(fields ? { fields } : {}) }
        : { kind: 'full' as const };
      const { contract, grant } = await gateway.confirm({
        transactionId: session.lastTransactionId,
        bppId: o.bppId,
        bppUri: o.bppUri,
        offerId,
        resourceId: o.resourceId,
        grantee: { id: config.granteeId },
        purpose,
        licenseClass: o.licenseClass,
        scope: grantScope,
      });
      const accessUrl =
        accessUrlFromContract(contract) ??
        `${o.bppUri}/download?resourceId=${encodeURIComponent(o.resourceId)}&offerId=${encodeURIComponent(offerId)}`;
      session.recordGrant({
        grantId: grant.claims.grantId,
        signedGrant: grant,
        offerId,
        resourceId: o.resourceId,
        bppUri: o.bppUri,
        accessUrl,
      });
      return ok(
        `Access granted for ${o.name}.\n` +
          `grant: ${grant.claims.grantId}\n` +
          `scope: ${JSON.stringify(grant.claims.scope)}\npurpose: ${grant.claims.purpose}\n` +
          `expires: ${new Date(grant.claims.expiresAt * 1000).toISOString()}\n\n` +
          `Call download with offerId "${offerId}" to retrieve the data.`,
      );
    },
  );

  server.registerTool(
    'list_my_grants',
    {
      title: 'List my grants',
      description: 'List the Access Grants issued to this agent, with status and expiry.',
      inputSchema: {},
    },
    async () => {
      const grants = await gateway.listGrants(config.granteeId);
      if (grants.length === 0) return ok('No grants have been issued to you yet.');
      const lines = grants.map((g) => {
        const exp = new Date(Number(g.expiresAt) * 1000).toISOString();
        return `• ${String(g.grantId)} [${String(g.status)}] ${String(g.resourceId)} (expires ${exp})`;
      });
      return ok(`Your grants:\n${lines.join('\n')}`);
    },
  );

  server.registerTool(
    'revoke_grant',
    {
      title: 'Revoke a grant',
      description:
        'Revoke an Access Grant. The provider will immediately reject any download presenting it.',
      inputSchema: { grantId: z.string() },
    },
    async ({ grantId }) => {
      const r = await gateway.revokeGrant(grantId, 'revoked via MCP by grantee');
      if (r.httpStatus === 404) return fail(`Grant ${grantId} not found.`);
      return ok(
        `Grant ${grantId}: ${r.outcome}. The provider will now reject any download with it.`,
      );
    },
  );

  server.registerTool(
    'download',
    {
      title: 'Download the data',
      description:
        'Retrieve the dataset/model file by presenting a valid Access Grant to the provider. ' +
        'Give an offerId (uses the latest grant for it) or an explicit grantId.',
      inputSchema: {
        offerId: z.string().optional(),
        grantId: z.string().optional(),
      },
    },
    async ({ offerId, grantId }) => {
      const ref = grantId
        ? session.getGrant(grantId)
        : offerId
          ? session.latestGrantForOffer(offerId)
          : undefined;
      if (!ref) {
        return fail('No grant available. Run confirm_access first, or pass a grantId.');
      }
      const url =
        ref.accessUrl ??
        `${ref.bppUri}/download?resourceId=${encodeURIComponent(ref.resourceId)}&offerId=${encodeURIComponent(ref.offerId)}`;
      const res = await gateway.download(url, ref.signedGrant);
      if (!res.ok) {
        return fail(
          `Download refused by the provider: HTTP ${res.httpStatus} (${res.error ?? 'error'}).`,
        );
      }
      mkdirSync(config.downloadDir, { recursive: true });
      const filename = res.filename ?? `${ref.offerId}.dat`;
      const dest = join(config.downloadDir, filename);
      const body = res.body ?? '';
      writeFileSync(dest, body);
      const lines = body.split('\n').filter(Boolean);
      const preview = body.split('\n').slice(0, 6).join('\n');
      return ok(
        `Downloaded ${filename} (${body.length} bytes, ~${Math.max(lines.length - 1, 0)} rows) to:\n${dest}\n\n` +
          `Preview:\n${preview}`,
      );
    },
  );

  return server;
}
