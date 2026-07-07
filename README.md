# Beckn Data Commons (BDC)

A Beckn-native, consent-governed dataset & model exchange — natively accessible to AI agents via
MCP, with a locally fine-tuned NLU layer (stretch).

ML datasets and pretrained models are discovered, licensed, and accessed under a DEPA-inspired
**Access Grant** (a signed, scoped, revocable consent artifact) instead of a raw download link,
and the whole network is transactable by any LLM agent through an MCP server.

> Full architecture, rationale, and phase plan: [`PROJECT_PLAN.md`](./PROJECT_PLAN.md).
> Working strategy and conventions: [`CLAUDE.md`](./CLAUDE.md).

## Status

**Phase 0 — Environment & scaffold.** A pnpm/TypeScript monorepo with four health-checking
services (BAP, BPP, Access Manager, MCP server) plus Postgres and Redis, orchestrated by Docker
Compose. Product logic lands from Phase 2 onward.

## Architecture (services)

| Service           | Port | Role                                                            |
| ----------------- | ---- | -------------------------------------------------------------- |
| `bap`             | 3001 | Beckn Application Platform — consumer gateway / orchestrator    |
| `bpp`             | 3002 | Beckn Provider Platform — config-driven dataset/model provider  |
| `access-manager`  | 3003 | Consent-artifact / Access Grant issuance, revocation, expiry    |
| `mcp-server`      | 3004 | MCP tools wrapping the BAP + Access Manager for LLM agents      |

Shared packages: `@bdc/beckn-schemas` (Zod schemas), `@bdc/crypto-utils` (Ed25519 + canonical JSON).

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
