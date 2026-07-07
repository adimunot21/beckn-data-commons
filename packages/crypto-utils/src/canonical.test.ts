import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical.js';

describe('canonicalJson', () => {
  it('sorts object keys lexicographically', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('is order-independent for equivalent objects', () => {
    const a = canonicalJson({ scope: 'full', purpose: 'train', expiry: 10 });
    const b = canonicalJson({ expiry: 10, purpose: 'train', scope: 'full' });
    expect(a).toBe(b);
  });

  it('sorts keys recursively in nested objects', () => {
    expect(canonicalJson({ z: { y: 1, x: 2 }, a: 3 })).toBe('{"a":3,"z":{"x":2,"y":1}}');
  });

  it('preserves array order (arrays are not sorted)', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles null, booleans, and strings', () => {
    expect(canonicalJson({ n: null, t: true, s: 'hi' })).toBe('{"n":null,"s":"hi","t":true}');
  });

  it('throws on non-finite numbers', () => {
    expect(() => canonicalJson({ x: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ x: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
  });

  it('throws on undefined values rather than silently dropping them', () => {
    // @ts-expect-error deliberately passing an invalid value to assert runtime guard
    expect(() => canonicalJson({ x: undefined })).toThrow(/undefined/);
  });
});
