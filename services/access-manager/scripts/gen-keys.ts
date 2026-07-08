/**
 * Generate an Access Manager Ed25519 keypair for local/dev use.
 * Prints KEY=VALUE lines to export into the environment.
 *
 * Usage: pnpm --filter @bdc/access-manager gen-keys
 */
import { generateKeyPair } from '@bdc/crypto-utils';

const kp = await generateKeyPair();
console.log(`AM_PRIVATE_KEY=${kp.privateKey}`);
console.log(`ACCESS_MANAGER_PUBLIC_KEY=${kp.publicKey}`);
