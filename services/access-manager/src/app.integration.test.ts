import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { generateKeyPair, type KeyPair } from '@bdc/crypto-utils';
import { verifyGrant } from '@bdc/beckn-schemas';
import { createApp } from './app.js';
import { GrantService } from './service.js';
import { InMemoryGrantStore } from './stores/memory.js';
import type { AmConfig } from './config.js';

const NOW = 1_800_000_000;

let issuer: KeyPair;
let app: FastifyInstance;

const config = (): AmConfig => ({
  serviceName: 'access-manager:test',
  port: 0,
  host: '127.0.0.1',
  amId: 'access-manager.bdc.local',
  issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
  privateKey: issuer.privateKey,
  grantTtlSeconds: 3600,
  databaseUrl: undefined,
});

const issueBody = () => ({
  grantee: { id: 'agent-42' },
  provider: { bppId: 'bpp.tabular.local', bppUri: 'https://bpp.tabular.local' },
  resource: { resourceId: 'ds-churn', offerId: 'offer-churn-full' },
  scope: { kind: 'full' },
  licenseClass: 'permissive',
  purpose: 'train a churn classifier',
  transactionId: randomUUID(),
});

beforeAll(async () => {
  issuer = await generateKeyPair();
  const service = new GrantService({
    amId: 'access-manager.bdc.local',
    issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
    privateKey: issuer.privateKey,
    publicKey: issuer.publicKey,
    ttlSeconds: 3600,
    store: new InMemoryGrantStore(),
  });
  app = createApp({ config: config(), service, now: () => new Date(NOW * 1000), logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Access Manager API', () => {
  it('exposes the issuer public key', async () => {
    const res = await app.inject({ method: 'GET', url: '/pubkey' });
    expect(res.statusCode).toBe(200);
    expect(res.json().publicKey).toBe(issuer.publicKey);
    expect(res.json().alg).toBe('ed25519');
  });

  it('issues a grant that verifies against the advertised key', async () => {
    const res = await app.inject({ method: 'POST', url: '/grants', payload: issueBody() });
    expect(res.statusCode).toBe(201);
    const signed = res.json();
    const check = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
      expectedBppId: 'bpp.tabular.local',
      requested: { resourceId: 'ds-churn' },
    });
    expect(check.ok).toBe(true);
  });

  it('400 for an invalid issue request', async () => {
    const res = await app.inject({ method: 'POST', url: '/grants', payload: { grantee: {} } });
    expect(res.statusCode).toBe(400);
  });

  it('revokes a grant and reflects REVOKED status; 409 on repeat', async () => {
    const issued = await app.inject({ method: 'POST', url: '/grants', payload: issueBody() });
    const grantId = issued.json().claims.grantId as string;

    const rev = await app.inject({
      method: 'POST',
      url: `/grants/${grantId}/revoke`,
      payload: { reason: 'test' },
    });
    expect(rev.statusCode).toBe(200);
    expect(rev.json().status).toBe('REVOKED');

    const status = await app.inject({ method: 'GET', url: `/grants/${grantId}` });
    expect(status.json().status).toBe('REVOKED');

    const again = await app.inject({
      method: 'POST',
      url: `/grants/${grantId}/revoke`,
      payload: {},
    });
    expect(again.statusCode).toBe(409);
  });

  it('404 when revoking an unknown grant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/grants/${randomUUID()}/revoke`,
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it('lists grants by grantee', async () => {
    const res = await app.inject({ method: 'GET', url: '/grants?grantee=agent-42' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().grants)).toBe(true);
    expect(res.json().grants.length).toBeGreaterThan(0);
  });
});
