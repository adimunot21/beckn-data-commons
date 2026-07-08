import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeAll } from 'vitest';
import { generateKeyPair, type KeyPair } from '@bdc/crypto-utils';
import { verifyGrant, type IssueGrantRequest } from '@bdc/beckn-schemas';
import { GrantService } from './service.js';
import { InMemoryGrantStore } from './stores/memory.js';

const NOW = 1_800_000_000;

let issuer: KeyPair;
beforeAll(async () => {
  issuer = await generateKeyPair();
});

function service(store = new InMemoryGrantStore()): {
  svc: GrantService;
  store: InMemoryGrantStore;
} {
  const svc = new GrantService({
    amId: 'access-manager.bdc.local',
    issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
    privateKey: issuer.privateKey,
    publicKey: issuer.publicKey,
    ttlSeconds: 3600,
    store,
  });
  return { svc, store };
}

function request(overrides: Partial<IssueGrantRequest> = {}): IssueGrantRequest {
  return {
    grantee: { id: 'agent-42' },
    provider: { bppId: 'bpp.tabular.local', bppUri: 'https://bpp.tabular.local' },
    resource: { resourceId: 'ds-churn', offerId: 'offer-churn-full' },
    scope: { kind: 'full' },
    licenseClass: 'permissive',
    purpose: 'train a churn classifier',
    transactionId: randomUUID(),
    ...overrides,
  };
}

describe('GrantService', () => {
  it('issues a grant that a BPP would verify with the AM public key', async () => {
    const { svc } = service();
    const signed = await svc.issue(request(), NOW);
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
      expectedBppId: 'bpp.tabular.local',
      requested: { resourceId: 'ds-churn', offerId: 'offer-churn-full' },
    });
    expect(res.ok).toBe(true);
  });

  it('honors a per-request ttl override in the expiry', async () => {
    const { svc } = service();
    const signed = await svc.issue(request({ ttlSeconds: 120 }), NOW);
    expect(signed.claims.expiresAt).toBe(NOW + 120);
  });

  it('persists the grant and lists it by grantee', async () => {
    const { svc, store } = service();
    const signed = await svc.issue(request(), NOW);
    const record = await store.get(signed.claims.grantId);
    expect(record?.status).toBe('ISSUED');
    const list = await svc.list('agent-42');
    expect(list.map((g) => g.grantId)).toContain(signed.claims.grantId);
  });

  it('revokes an issued grant, then reports already-revoked', async () => {
    const { svc } = service();
    const signed = await svc.issue(request(), NOW);
    expect(await svc.revoke(signed.claims.grantId, 'user')).toBe('revoked');
    expect(await svc.revoke(signed.claims.grantId, 'user')).toBe('already-revoked');
    expect((await svc.get(signed.claims.grantId))?.status).toBe('REVOKED');
  });

  it('reports not-found when revoking an unknown grant', async () => {
    const { svc } = service();
    expect(await svc.revoke(randomUUID(), 'x')).toBe('not-found');
  });

  it('sweeps expired grants', async () => {
    const { svc } = service();
    const signed = await svc.issue(request({ ttlSeconds: 60 }), NOW);
    expect(await svc.sweepExpired(NOW + 120)).toBe(1);
    expect((await svc.get(signed.claims.grantId))?.status).toBe('EXPIRED');
  });
});
