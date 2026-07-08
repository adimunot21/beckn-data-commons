/* global process */
// Generate per-participant Ed25519 keypairs for BDC per-hop message auth and emit
// a sourceable env file: each participant's BECKN_PRIVATE_KEY plus the shared
// BECKN_REGISTRY (all public keys). Never commit the output.
//
//   node infra/gen-beckn-keys.mjs > infra/beckn-keys.env
//   set -a; source infra/beckn-keys.env; source infra/am-keys.env; set +a
//   docker compose -f infra/docker-compose.yml up -d
import { generateKeyPair } from '../packages/crypto-utils/dist/index.js';

const participants = {
  BAP: 'bap.bdc.local',
  BPP_TABULAR: 'bpp.tabular.local',
  BPP_VISION: 'bpp.vision.local',
  BPP_MODELS: 'bpp.models.local',
};

const lines = [];
const registry = [];
for (const [prefix, keyId] of Object.entries(participants)) {
  const kp = await generateKeyPair();
  lines.push(`${prefix}_BECKN_PRIVATE_KEY=${kp.privateKey}`);
  registry.push(`${keyId}=${kp.publicKey}`);
}
lines.push(`BECKN_REGISTRY=${registry.join(',')}`);
process.stdout.write(lines.join('\n') + '\n');
