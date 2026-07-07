import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeAll } from 'vitest';
import { generateKeyPair, type KeyPair } from '@bdc/crypto-utils';
import {
  issueGrant,
  verifyGrant,
  AccessGrantClaims,
  type AccessGrantClaims as Claims,
} from './grant.js';

const NOW = 1_800_000_000; // fixed unix seconds for deterministic temporal tests

function makeClaims(overrides: Partial<Claims> = {}): Claims {
  return AccessGrantClaims.parse({
    v: 'bdc-grant/1',
    grantId: randomUUID(),
    issuer: 'access-manager.bdc.local',
    issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
    grantee: { id: 'agent-42' },
    provider: { bppId: 'bpp.tabular.local', bppUri: 'https://bpp.tabular.local' },
    resource: { resourceId: 'ds-churn-001', offerId: 'offer-churn-full' },
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

let issuer: KeyPair;
beforeAll(async () => {
  issuer = await generateKeyPair();
});

describe('Access Grant issue + offline verify', () => {
  it('a freshly issued grant verifies and demands an online revocation check', async () => {
    const signed = await issueGrant(makeClaims(), issuer.privateKey);
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.requiresRevocationCheck).toBe(true);
  });

  it('rejects a tampered claim (signature no longer matches)', async () => {
    const signed = await issueGrant(makeClaims({ scope: { kind: 'sample' } }), issuer.privateKey);
    // Attacker upgrades scope to full after signing.
    signed.claims.scope = { kind: 'full' };
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
    });
    expect(res).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a grant signed by a different issuer key', async () => {
    const other = await generateKeyPair();
    const signed = await issueGrant(makeClaims(), other.privateKey);
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
    });
    expect(res).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('rejects an expired grant (beyond clock skew)', async () => {
    const signed = await issueGrant(
      makeClaims({ notBefore: NOW - 3600, expiresAt: NOW - 100 }),
      issuer.privateKey,
    );
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
    });
    expect(res).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('rejects a not-yet-valid grant', async () => {
    const signed = await issueGrant(
      makeClaims({ notBefore: NOW + 500, expiresAt: NOW + 3600 }),
      issuer.privateKey,
    );
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
    });
    expect(res).toMatchObject({ ok: false, reason: 'not-yet-valid' });
  });

  it('tolerates small clock skew at the expiry boundary', async () => {
    const signed = await issueGrant(
      makeClaims({ notBefore: NOW - 3600, expiresAt: NOW - 10 }),
      issuer.privateKey,
    );
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
      clockSkewSeconds: 30,
    });
    expect(res.ok).toBe(true);
  });

  it('rejects a grant presented to the wrong BPP', async () => {
    const signed = await issueGrant(makeClaims(), issuer.privateKey);
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
      expectedBppId: 'bpp.vision.local',
    });
    expect(res).toMatchObject({ ok: false, reason: 'wrong-provider' });
  });

  it('rejects a grant redeemed for a different resource', async () => {
    const signed = await issueGrant(makeClaims(), issuer.privateKey);
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
      requested: { resourceId: 'ds-someone-elses' },
    });
    expect(res).toMatchObject({ ok: false, reason: 'wrong-resource' });
  });

  it('enforces subset scope — rejects fields outside the grant', async () => {
    const signed = await issueGrant(
      makeClaims({ scope: { kind: 'subset', fields: ['age', 'tenure'] } }),
      issuer.privateKey,
    );
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
      requested: { resourceId: 'ds-churn-001', fields: ['age', 'salary'] },
    });
    expect(res).toMatchObject({ ok: false, reason: 'scope-insufficient' });
  });

  it('allows subset access within the granted fields', async () => {
    const signed = await issueGrant(
      makeClaims({ scope: { kind: 'subset', fields: ['age', 'tenure'] } }),
      issuer.privateKey,
    );
    const res = await verifyGrant(signed, {
      issuerPublicKeyHex: issuer.publicKey,
      nowSeconds: NOW,
      requested: { resourceId: 'ds-churn-001', fields: ['age'] },
    });
    expect(res.ok).toBe(true);
  });

  it('rejects a structurally malformed grant', async () => {
    const res = await verifyGrant(
      { claims: { v: 'bdc-grant/1' }, alg: 'ed25519', signature: 'x' },
      { issuerPublicKeyHex: issuer.publicKey, nowSeconds: NOW },
    );
    expect(res).toMatchObject({ ok: false, reason: 'malformed' });
  });
});
