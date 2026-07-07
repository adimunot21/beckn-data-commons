/**
 * @bdc/crypto-utils
 *
 * Cryptographic helpers for Beckn Data Commons. The Ed25519 signing/verification
 * layer (message + Access Grant signatures) is built in Phase 2. This module
 * ships the one primitive that layer depends on: canonical JSON serialization,
 * so that a signature computed by the issuer is byte-for-byte reproducible by
 * any verifier regardless of key insertion order.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Deterministically serialize a JSON value with object keys sorted
 * lexicographically (recursively). Signatures are computed over the UTF-8 bytes
 * of this string so signer and verifier always agree on the exact payload.
 *
 * Throws on non-finite numbers (NaN/Infinity have no canonical JSON form) and on
 * `undefined`, which must never silently drop a field from a signed payload.
 */
export function canonicalJson(value: JsonValue): string {
  return serialize(value);
}

function serialize(value: JsonValue): string {
  if (value === null) return 'null';

  const type = typeof value;

  if (type === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new TypeError(`canonicalJson: non-finite number is not serializable: ${String(value)}`);
    }
    return JSON.stringify(value);
  }

  if (type === 'boolean' || type === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serialize(item)).join(',')}]`;
  }

  if (type === 'object') {
    const entries = Object.entries(value as { [key: string]: JsonValue });
    const parts: string[] = [];
    for (const [key, val] of entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (val === undefined) {
        throw new TypeError(`canonicalJson: undefined value at key "${key}" is not serializable`);
      }
      parts.push(`${JSON.stringify(key)}:${serialize(val)}`);
    }
    return `{${parts.join(',')}}`;
  }

  throw new TypeError(`canonicalJson: unsupported value type "${type}"`);
}
