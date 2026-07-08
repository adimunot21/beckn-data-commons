/**
 * Drives the MCP server through a real SDK Client over an in-memory transport,
 * with a fake backend gateway — exercising the whole tool surface end-to-end
 * without a running network.
 */
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { SignedAccessGrant } from '@bdc/beckn-schemas';
import { createServer } from './server.js';
import type {
  BdcGateway,
  ConfirmParams,
  ConfirmResponse,
  DownloadResult,
  Json,
  RevokeResult,
  SearchResponse,
} from './gateway.js';
import type { McpConfig } from './config.js';

const NOW = 1_800_000_000;

const fakeGrant = {
  claims: {
    grantId: 'g1',
    scope: { kind: 'full' },
    purpose: 'train a churn model',
    expiresAt: NOW + 3600,
  },
  alg: 'ed25519',
  signature: 'x',
} as unknown as SignedAccessGrant;

const revoked = new Set<string>();

const fakeGateway: BdcGateway = {
  async search(): Promise<SearchResponse> {
    return {
      transactionId: 'txn-1',
      providers: ['bpp.tabular.local'],
      catalogs: [
        {
          bppId: 'bpp.tabular.local',
          bppUri: 'http://localhost:3002',
          offers: [
            {
              id: 'offer-churn-full',
              descriptor: { name: 'Customer Churn' },
              resourceIds: ['ds-churn'],
              offerAttributes: {
                '@type': 'DatasetItem',
                'schema:name': 'Customer Churn',
                'schema:description': 'Synthetic telco churn dataset',
                'bdc:resourceKind': 'dataset',
                'bdc:modality': 'tabular',
                'bdc:taskType': 'classification',
                'bdc:licenseClass': 'permissive',
                'dataset:rowCountEstimate': 3000,
                'dataset:columnCount': 6,
              },
            },
          ],
        },
      ],
    };
  },
  async select(): Promise<Json> {
    return { status: { code: 'DRAFT' } };
  },
  async init(): Promise<Json> {
    return { status: { code: 'ACTIVE' } };
  },
  async confirm(params: ConfirmParams): Promise<ConfirmResponse> {
    return {
      contract: {
        status: { code: 'ACTIVE' },
        performance: [
          {
            performanceAttributes: {
              'fulfillment:accessUrl': `http://localhost:3002/download?resourceId=${params.resourceId}&offerId=${params.offerId}`,
            },
          },
        ],
      },
      grant: fakeGrant,
    };
  },
  async listGrants(): Promise<Json[]> {
    return [
      {
        grantId: 'g1',
        status: revoked.has('g1') ? 'REVOKED' : 'ISSUED',
        resourceId: 'ds-churn',
        expiresAt: NOW + 3600,
      },
    ];
  },
  async revokeGrant(grantId: string): Promise<RevokeResult> {
    if (grantId !== 'g1') return { outcome: 'not-found', httpStatus: 404 };
    revoked.add(grantId);
    return { outcome: 'revoked', httpStatus: 200 };
  },
  async download(url: string): Promise<DownloadResult> {
    if (revoked.has('g1')) return { ok: false, httpStatus: 403, error: 'revoked' };
    void url;
    return {
      ok: true,
      httpStatus: 200,
      contentType: 'text/csv',
      filename: 'churn.csv',
      body: 'customer_id,age,churn\ncust-0,26,0\ncust-1,59,1\n',
    };
  },
};

let client: Client;
let downloadDir: string;

async function callText(
  name: string,
  args: Json = {},
): Promise<{ text: string; isError: boolean }> {
  const res = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  return { text: res.content.map((c) => c.text).join('\n'), isError: res.isError ?? false };
}

beforeAll(async () => {
  downloadDir = mkdtempSync(join(tmpdir(), 'bdc-mcp-'));
  const config: McpConfig = {
    bapUrl: 'http://bap',
    amUrl: 'http://am',
    granteeId: 'claude-agent',
    downloadDir,
  };
  const server = createServer({ config, gateway: fakeGateway });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client.close();
});

describe('BDC MCP server', () => {
  it('exposes all seven tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'confirm_access',
      'download',
      'list_my_grants',
      'request_access',
      'revoke_grant',
      'search_resources',
      'view_resource',
    ]);
  });

  it('drives the full flow: search -> view -> confirm -> download', async () => {
    const search = await callText('search_resources', { query: 'churn', purpose: 'train a model' });
    expect(search.text).toContain('offer-churn-full');

    const view = await callText('view_resource', { offerId: 'offer-churn-full' });
    expect(view.text).toContain('Customer Churn');

    const confirm = await callText('confirm_access', {
      offerId: 'offer-churn-full',
      purpose: 'train a churn model',
    });
    expect(confirm.text).toContain('grant: g1');

    const dl = await callText('download', { offerId: 'offer-churn-full' });
    expect(dl.text).toContain('Downloaded churn.csv');
    expect(dl.text).toContain('customer_id');
    // The file really landed on disk.
    const dest = join(downloadDir, 'churn.csv');
    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest, 'utf-8')).toContain('cust-0');
  });

  it('view_resource errors for an unknown offer', async () => {
    const res = await callText('view_resource', { offerId: 'nope' });
    expect(res.isError).toBe(true);
  });

  it('list_my_grants shows the issued grant', async () => {
    const res = await callText('list_my_grants');
    expect(res.text).toContain('g1');
  });

  it('revoke then download is refused', async () => {
    const rev = await callText('revoke_grant', { grantId: 'g1' });
    expect(rev.text).toContain('revoked');
    const dl = await callText('download', { offerId: 'offer-churn-full' });
    expect(dl.isError).toBe(true);
    expect(dl.text).toContain('403');
  });
});
