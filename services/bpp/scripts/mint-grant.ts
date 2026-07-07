/**
 * Dev helper: mint a real Access Grant for manual/e2e verification of a BPP's
 * download endpoint (before the Access Manager exists in Phase 4).
 *
 * Prints the issuer public key and a ready-to-use Authorization header.
 * Usage: AM_PRIVATE_KEY=<hex?> tsx scripts/mint-grant.ts
 */
import { randomUUID } from 'node:crypto';
import { generateKeyPair, publicKeyFor } from '@bdc/crypto-utils';
import { AccessGrantClaims, issueGrant } from '@bdc/beckn-schemas';
import { encodePresentedGrant } from '../src/download.js';

const bppId = process.env.BPP_ID ?? 'bpp.tabular.local';
const bppUri = process.env.BPP_URI ?? 'http://localhost:3002';
const resourceId = process.env.RESOURCE_ID ?? 'ds-churn';
const offerId = process.env.OFFER_ID ?? 'offer-churn-full';

async function main(): Promise<void> {
  const privateKey = process.env.AM_PRIVATE_KEY ?? (await generateKeyPair()).privateKey;
  const publicKey = await publicKeyFor(privateKey);
  const now = Math.floor(Date.now() / 1000);

  const claims = AccessGrantClaims.parse({
    v: 'bdc-grant/1',
    grantId: randomUUID(),
    issuer: 'access-manager.bdc.local',
    issuerKeyId: 'access-manager.bdc.local|key-1|ed25519',
    grantee: { id: 'agent-cli' },
    provider: { bppId, bppUri },
    resource: { resourceId, offerId },
    scope: { kind: 'full' },
    licenseClass: 'permissive',
    purpose: 'manual e2e verification',
    transactionId: randomUUID(),
    issuedAt: now,
    notBefore: now,
    expiresAt: now + 3600,
    revocable: true,
    nonce: randomUUID(),
  });
  const grant = await issueGrant(claims, privateKey);

  // Machine-parseable output (KEY=VALUE lines).
  console.log(`AM_PRIVATE_KEY=${privateKey}`);
  console.log(`ACCESS_MANAGER_PUBLIC_KEY=${publicKey}`);
  console.log(`GRANT_ID=${claims.grantId}`);
  console.log(`AUTH_HEADER=${encodePresentedGrant(grant)}`);
}

void main();
