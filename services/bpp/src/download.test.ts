import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeAll } from 'vitest';
import { generateKeyPair, type KeyPair } from '@bdc/crypto-utils';
import {
  AccessGrantClaims,
  issueGrant,
  type AccessGrantClaims as Claims,
} from '@bdc/beckn-schemas';
import {
  redeemGrant,
  parsePresentedGrant,
  encodePresentedGrant,
  type FileResolver,
} from './download.js';
import { InMemoryRevocationStore, InMemoryRedemptionStore } from './stores/memory.js';

const NOW = 1_800_000_000;
const BPP_ID = 'bpp.tabular.local';
const RESOURCE_ID = 'ds-churn-001';
const OFFER_ID = 'offer-churn-full';

let am: KeyPair;
beforeAll(async () => {
  am = await generateKeyPair();
});

function claims(overrides: Partial<Claims> = {}): Claims {
  return AccessGrantClaims.parse({
    v: 'bdc-grant/1',
    grantId: randomUUID(),
    issuer: 'access-manager.bdc.local',
    issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
    grantee: { id: 'agent-42' },
    provider: { bppId: BPP_ID, bppUri: 'https://bpp.tabular.local' },
    resource: { resourceId: RESOURCE_ID, offerId: OFFER_ID },
    scope: { kind: 'full' },
    licenseClass: 'permissive',
    purpose: 'train a churn classifier',
    transactionId: randomUUID(),
    issuedAt: NOW,
    notBefore: NOW,
    expiresAt: NOW + 3600,
    revocable: true,
    nonce: randomUUID(),
    ...overrides,
  });
}

const resolveFile: FileResolver = () => ({
  path: '/seed/churn.csv',
  filename: 'churn.csv',
  contentType: 'text/csv',
});

function baseParams(overrides: Partial<Parameters<typeof redeemGrant>[0]> = {}) {
  return {
    signedGrant: undefined as unknown,
    requested: { resourceId: RESOURCE_ID, offerId: OFFER_ID },
    bppId: BPP_ID,
    accessManagerPublicKey: am.publicKey,
    nowSeconds: NOW,
    clockSkewSeconds: 30,
    revocations: new InMemoryRevocationStore(),
    redemptions: new InMemoryRedemptionStore(),
    resolveFile,
    ...overrides,
  };
}

describe('redeemGrant', () => {
  it('serves a valid grant', async () => {
    const grant = await issueGrant(claims(), am.privateKey);
    const res = await redeemGrant(baseParams({ signedGrant: grant }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.file.filename).toBe('churn.csv');
      expect(res.redemptionCount).toBe(1);
    }
  });

  it('refuses to serve when the issuer key is unconfigured (misconfig)', async () => {
    const grant = await issueGrant(claims(), am.privateKey);
    const res = await redeemGrant(baseParams({ signedGrant: grant, accessManagerPublicKey: '' }));
    expect(res).toMatchObject({ ok: false, status: 503, reason: 'issuer-key-unconfigured' });
  });

  it('rejects an expired grant with 403', async () => {
    const grant = await issueGrant(
      claims({ notBefore: NOW - 7200, expiresAt: NOW - 100 }),
      am.privateKey,
    );
    const res = await redeemGrant(baseParams({ signedGrant: grant }));
    expect(res).toMatchObject({ ok: false, status: 403, reason: 'expired' });
  });

  it('rejects a wrong-scope (subset overreach) grant with 403', async () => {
    const grant = await issueGrant(
      claims({ scope: { kind: 'subset', fields: ['age'] } }),
      am.privateKey,
    );
    const res = await redeemGrant(
      baseParams({
        signedGrant: grant,
        requested: { resourceId: RESOURCE_ID, fields: ['age', 'salary'] },
      }),
    );
    expect(res).toMatchObject({ ok: false, status: 403, reason: 'scope-insufficient' });
  });

  it('rejects a grant meant for a different BPP', async () => {
    const grant = await issueGrant(
      claims({ provider: { bppId: 'bpp.vision.local', bppUri: 'https://bpp.vision.local' } }),
      am.privateKey,
    );
    const res = await redeemGrant(baseParams({ signedGrant: grant }));
    expect(res).toMatchObject({ ok: false, status: 403, reason: 'wrong-provider' });
  });

  it('rejects a revoked grant even though it is validly signed and unexpired', async () => {
    const c = claims();
    const grant = await issueGrant(c, am.privateKey);
    const revocations = new InMemoryRevocationStore();
    await revocations.revoke(c.grantId, 'test');
    const res = await redeemGrant(baseParams({ signedGrant: grant, revocations }));
    expect(res).toMatchObject({ ok: false, status: 403, reason: 'revoked' });
  });

  it('enforces maxDownloads across repeated redemptions', async () => {
    const grant = await issueGrant(
      claims({ scope: { kind: 'full', maxDownloads: 2 } }),
      am.privateKey,
    );
    const shared = {
      revocations: new InMemoryRevocationStore(),
      redemptions: new InMemoryRedemptionStore(),
    };
    const p = () => baseParams({ signedGrant: grant, ...shared });
    expect((await redeemGrant(p())).ok).toBe(true); // 1
    expect((await redeemGrant(p())).ok).toBe(true); // 2
    const third = await redeemGrant(p()); // 3 -> over cap
    expect(third).toMatchObject({ ok: false, status: 403, reason: 'download-limit-exceeded' });
  });

  it('returns 400 for a structurally malformed grant', async () => {
    const res = await redeemGrant(baseParams({ signedGrant: { not: 'a grant' } }));
    expect(res).toMatchObject({ ok: false, status: 400, reason: 'malformed' });
  });

  it('returns 404 when the resource file cannot be resolved (without burning a redemption)', async () => {
    const c = claims();
    const grant = await issueGrant(c, am.privateKey);
    const redemptions = new InMemoryRedemptionStore();
    const res = await redeemGrant(
      baseParams({ signedGrant: grant, resolveFile: () => undefined, redemptions }),
    );
    expect(res).toMatchObject({ ok: false, status: 404, reason: 'resource-unavailable' });
    expect(await redemptions.getCount(c.grantId)).toBe(0);
  });
});

describe('grant presentation encoding', () => {
  it('round-trips through the Authorization header format', async () => {
    const grant = await issueGrant(claims(), am.privateKey);
    const header = encodePresentedGrant(grant);
    expect(header.startsWith('Grant ')).toBe(true);
    expect(parsePresentedGrant(header)).toEqual(grant);
  });

  it('returns undefined for absent or malformed headers', () => {
    expect(parsePresentedGrant(undefined)).toBeUndefined();
    expect(parsePresentedGrant('Bearer xyz')).toBeUndefined();
    expect(parsePresentedGrant('Grant !!!not-base64!!!')).toBeUndefined();
  });
});
