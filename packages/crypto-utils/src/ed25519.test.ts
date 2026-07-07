import { describe, expect, it } from 'vitest';
import {
  generateKeyPair,
  publicKeyFor,
  sign,
  verify,
  signCanonical,
  verifyCanonical,
} from './index.js';

describe('ed25519', () => {
  it('generates 32-byte hex keypairs whose public key is derivable', async () => {
    const kp = await generateKeyPair();
    expect(kp.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(await publicKeyFor(kp.privateKey)).toBe(kp.publicKey);
  });

  it('signs and verifies a message round-trip', async () => {
    const kp = await generateKeyPair();
    const sig = await sign('hello world', kp.privateKey);
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
    expect(await verify(sig, 'hello world', kp.publicKey)).toBe(true);
  });

  it('rejects a tampered message', async () => {
    const kp = await generateKeyPair();
    const sig = await sign('grant:scope=full', kp.privateKey);
    expect(await verify(sig, 'grant:scope=sample', kp.publicKey)).toBe(false);
  });

  it('rejects a signature from a different key', async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    const sig = await sign('msg', a.privateKey);
    expect(await verify(sig, 'msg', b.publicKey)).toBe(false);
  });

  it('returns false (does not throw) on malformed signature or key', async () => {
    const kp = await generateKeyPair();
    expect(await verify('not-hex', 'msg', kp.publicKey)).toBe(false);
    expect(await verify('ab', 'msg', kp.publicKey)).toBe(false);
    expect(await verify(await sign('msg', kp.privateKey), 'msg', 'short')).toBe(false);
  });

  it('throws on malformed private key when signing', async () => {
    await expect(sign('msg', 'xyz')).rejects.toThrow(/privateKey/);
  });

  it('signs canonically — key order does not affect the signature', async () => {
    const kp = await generateKeyPair();
    const sig = await signCanonical({ b: 1, a: 2 }, kp.privateKey);
    expect(await verifyCanonical(sig, { a: 2, b: 1 }, kp.publicKey)).toBe(true);
  });

  it('canonical verify fails if a claim value changes', async () => {
    const kp = await generateKeyPair();
    const sig = await signCanonical({ scope: 'full', exp: 100 }, kp.privateKey);
    expect(await verifyCanonical(sig, { scope: 'full', exp: 101 }, kp.publicKey)).toBe(false);
  });
});
