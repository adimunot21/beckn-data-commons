# Beckn Data Commons (BDC)

A Beckn-native, consent-governed dataset & model exchange — natively accessible to AI agents via
MCP, with a locally fine-tuned NLU layer (stretch).

ML datasets and pretrained models are discovered, licensed, and accessed under a DEPA-inspired
**Access Grant** (a signed, scoped, revocable consent artifact) instead of a raw download link,
and the whole network is transactable by any LLM agent through an MCP server.

> Full architecture, rationale, and phase plan: [`PROJECT_PLAN.md`](./PROJECT_PLAN.md).
> Working strategy and conventions: [`CLAUDE.md`](./CLAUDE.md).

## Status

**MVP complete and hardened (Phases 0–5, 7).** A full Beckn network — a BAP orchestrating
async search/select/init/confirm across three config-driven BPPs, an Access Manager issuing
signed, scoped, revocable Access Grants, and an MCP server that lets Claude drive the whole flow
in natural language: *search → obtain a grant → download real data → revoke → download refused.*
Every Beckn hop is Ed25519-signed and replay-protected; every download is grant-gated (offline
signature/scope/expiry + online revocation). 117 tests. Remaining: NLU fine-tune (Phase 6,
stretch), cloud deploy (Phase 8).

See [`docs/01_architecture.md`](./docs/01_architecture.md) for the guided tour.

## Architecture (services)

| Service            | Port              | Role                                                           |
| ------------------ | ----------------- | -------------------------------------------------------------- |
| `bap`              | 3001              | Beckn Application Platform — consumer gateway / orchestrator    |
| `bpp` (×3)         | 3002 / 3012 / 3022 | Provider platforms — tabular / image / model catalogs         |
| `access-manager`   | 3003              | Consent-artifact / Access Grant issuance, revocation, expiry   |
| `mcp-server`       | stdio             | Host-run MCP bridge for LLM agents — see `docs/mcp-setup.md`    |

Shared packages: `@bdc/beckn-schemas` (Zod schemas), `@bdc/crypto-utils` (Ed25519 + canonical JSON).

The MCP server is not a backend container; it is launched by an MCP client (Claude) and talks to the
network over localhost. Driving the whole flow in natural language: [`docs/mcp-setup.md`](./docs/mcp-setup.md).

Every Beckn hop is authenticated (Ed25519-signed, replay-protected) and every download is gated by a
signed, scoped, revocable Access Grant — the full threat model is in [`docs/security.md`](./docs/security.md).

## Prerequisites

- Node.js 22 (via `nvm use` — see `.nvmrc`)
- pnpm 9 (`corepack enable`)
- Docker + Docker Compose

## Quick start

```bash
# 1. Toolchain
nvm use
corepack enable

# 2. Install workspace dependencies
pnpm install

# 3. Lint, typecheck, build, test
pnpm lint && pnpm typecheck && pnpm build && pnpm test

# 4. Environment file
cp .env.example .env

# 5. Boot the network (from repo root)
docker compose -f infra/docker-compose.yml up --build

# 6. Health check (in another terminal)
curl localhost:3001/health   # bap
curl localhost:3002/health   # bpp
curl localhost:3003/health   # access-manager
curl localhost:3004/health   # mcp-server
```

Each `/health` returns `{"status":"ok","service":"<name>","timestamp":"..."}`.

## Repository layout

```
services/{bap,bpp,access-manager,mcp-server}   TS services (Fastify)
packages/{beckn-schemas,crypto-utils}          shared TS packages
infra/docker-compose.yml                        local orchestration
docs/                                           design + walkthrough docs
seed-data/                                       synthetic catalogs (Phase 3)
```

## Documentation

Start with the **architecture overview**, then the per-component walkthroughs.

| Doc | What it covers |
| --- | --- |
| [`docs/01_architecture.md`](./docs/01_architecture.md) | **Start here** — what BDC is, the end-to-end lifecycle, the two crypto layers, code map |
| [`docs/02_bap.md`](./docs/02_bap.md) | BAP — async orchestration, aggregation window, confirm→grant |
| [`docs/03_bpp.md`](./docs/03_bpp.md) | BPP — config-driven provider, the grant-gated download (`redeemGrant`) |
| [`docs/04_access_manager.md`](./docs/04_access_manager.md) | Access Manager — issuing, revoking, the shared revocation table |
| [`docs/05_mcp.md`](./docs/05_mcp.md) | MCP server — how an LLM agent drives the whole flow |
| [`docs/mcp-setup.md`](./docs/mcp-setup.md) | Running the MCP demo from Claude |
| [`docs/security.md`](./docs/security.md) | Per-hop message auth, grant verification, full threat model |
| [`docs/00_protocol.md`](./docs/00_protocol.md) · [`consent-artifact-spec.md`](./docs/consent-artifact-spec.md) · [`domain-schema.md`](./docs/domain-schema.md) · [`data-contract.md`](./docs/data-contract.md) | Protocol notes, consent-artifact spec, domain schema, external data contract |
