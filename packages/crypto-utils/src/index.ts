/**
 * @bdc/crypto-utils
 *
 * Cryptographic helpers for Beckn Data Commons: canonical JSON serialization and
 * Ed25519 signing/verification, the primitives the Access Grant (consent
 * artifact) is built on.
 */
export { canonicalJson, type JsonValue } from './canonical.js';
export {
  generateKeyPair,
  publicKeyFor,
  sign,
  verify,
  signCanonical,
  verifyCanonical,
  type KeyPair,
} from './ed25519.js';
