import { beforeAll, describe, expect, it } from 'vitest';
import { generateKeyPair, type KeyPair } from './ed25519.js';
import { ReplayCache, signMessage, verifyMessage } from './beckn-auth.js';

const NOW_MS = 1_800_000_000_000; // fixed clock
const body = {
  context: { action: 'discover', bapId: 'bap.bdc.local' },
  message: { intent: { q: 'churn' } },
};

let bap: KeyPair;
let attacker: KeyPair;

beforeAll(async () => {
  bap = await generateKeyPair();
  attacker = await generateKeyPair();
});

function registry(keyId: string): string | undefined {
  return keyId === 'bap.bdc.local' ? bap.publicKey : undefined;
}

describe('beckn message auth', () => {
  it('a signed message verifies against the sender key', async () => {
    const header = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: bap.privateKey,
      nowMs: NOW_MS,
    });
    const res = await verifyMessage(body, header, { resolveKey: registry, nowMs: NOW_MS });
    expect(res).toEqual({ ok: true, keyId: 'bap.bdc.local' });
  });

  it('rejects a missing header', async () => {
    const res = await verifyMessage(body, undefined, { resolveKey: registry, nowMs: NOW_MS });
    expect(res).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects a malformed header', async () => {
    const res = await verifyMessage(body, 'Bearer nope', { resolveKey: registry, nowMs: NOW_MS });
    expect(res).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects an unknown / untrusted signer', async () => {
    const header = await signMessage(body, {
      keyId: 'evil.local',
      privateKeyHex: attacker.privateKey,
      nowMs: NOW_MS,
    });
    const res = await verifyMessage(body, header, { resolveKey: registry, nowMs: NOW_MS });
    expect(res).toEqual({ ok: false, reason: 'unknown-key' });
  });

  it('rejects a signature from the wrong key (impersonation)', async () => {
    // Attacker claims to be the BAP but signs with their own key.
    const header = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: attacker.privateKey,
      nowMs: NOW_MS,
    });
    const res = await verifyMessage(body, header, { resolveKey: registry, nowMs: NOW_MS });
    expect(res).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('signs over the wire form: an undefined-valued key is dropped, not fatal', async () => {
    // JSON.stringify omits `publicKey: undefined`, so the verifier (which parses
    // the JSON) never sees it. Signer and verifier must still agree.
    const withUndef = { grantee: { id: 'agent', publicKey: undefined }, purpose: 'train' };
    const asReceived = JSON.parse(JSON.stringify(withUndef)); // { grantee: { id }, purpose }
    const header = await signMessage(withUndef as never, {
      keyId: 'bap.bdc.local',
      privateKeyHex: bap.privateKey,
      nowMs: NOW_MS,
    });
    const res = await verifyMessage(asReceived, header, { resolveKey: registry, nowMs: NOW_MS });
    expect(res).toEqual({ ok: true, keyId: 'bap.bdc.local' });
  });

  it('rejects a tampered body', async () => {
    const header = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: bap.privateKey,
      nowMs: NOW_MS,
    });
    const tampered = { ...body, message: { intent: { q: 'medical-records' } } };
    const res = await verifyMessage(tampered, header, { resolveKey: registry, nowMs: NOW_MS });
    expect(res).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects an expired message (now past the window)', async () => {
    const header = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: bap.privateKey,
      nowMs: NOW_MS,
      ttlSeconds: 30,
    });
    const later = NOW_MS + 60_000; // 60s later, window was 30s
    const res = await verifyMessage(body, header, { resolveKey: registry, nowMs: later });
    expect(res).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a not-yet-valid message (created in the future)', async () => {
    const header = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: bap.privateKey,
      nowMs: NOW_MS,
    });
    const earlier = NOW_MS - 60_000; // verifier clock 60s behind signer
    const res = await verifyMessage(body, header, { resolveKey: registry, nowMs: earlier });
    expect(res).toEqual({ ok: false, reason: 'not-yet-valid' });
  });

  it('rejects a replayed message with the same nonce', async () => {
    const cache = new ReplayCache(() => NOW_MS);
    const header = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: bap.privateKey,
      nowMs: NOW_MS,
      nonce: 'fixed-nonce-123',
    });
    const first = await verifyMessage(body, header, {
      resolveKey: registry,
      nowMs: NOW_MS,
      replayCache: cache,
    });
    expect(first.ok).toBe(true);
    const second = await verifyMessage(body, header, {
      resolveKey: registry,
      nowMs: NOW_MS,
      replayCache: cache,
    });
    expect(second).toEqual({ ok: false, reason: 'replayed' });
  });

  it('does not burn a nonce on a bad signature', async () => {
    const cache = new ReplayCache(() => NOW_MS);
    const forged = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: attacker.privateKey,
      nowMs: NOW_MS,
      nonce: 'shared-nonce',
    });
    const bad = await verifyMessage(body, forged, {
      resolveKey: registry,
      nowMs: NOW_MS,
      replayCache: cache,
    });
    expect(bad).toEqual({ ok: false, reason: 'bad-signature' });
    // The genuine sender can still use that nonce — the forgery didn't consume it.
    const genuine = await signMessage(body, {
      keyId: 'bap.bdc.local',
      privateKeyHex: bap.privateKey,
      nowMs: NOW_MS,
      nonce: 'shared-nonce',
    });
    const good = await verifyMessage(body, genuine, {
      resolveKey: registry,
      nowMs: NOW_MS,
      replayCache: cache,
    });
    expect(good.ok).toBe(true);
  });

  it('ReplayCache evicts entries past their expiry', () => {
    let clock = NOW_MS;
    const cache = new ReplayCache(() => clock);
    expect(cache.seen('k', Math.floor(NOW_MS / 1000) + 30)).toBe(false);
    expect(cache.seen('k', Math.floor(NOW_MS / 1000) + 30)).toBe(true); // still cached
    clock = NOW_MS + 60_000; // advance past expiry
    expect(cache.seen('k', Math.floor(clock / 1000) + 30)).toBe(false); // evicted, treated as new
  });
});
