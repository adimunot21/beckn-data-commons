# 01 · Architecture — how Beckn Data Commons fits together

This is the guided tour: what the system is, how a request flows end to end, and where each idea
lives in the code. Read this first, then dive into the per-component walkthroughs
([02_bap](./02_bap.md), [03_bpp](./03_bpp.md), [04_access_manager](./04_access_manager.md),
[05_mcp](./05_mcp.md)).

## The one-sentence version

BDC is a Beckn Protocol network for discovering and licensing ML datasets/models where **access is
gated by a signed, scoped, revocable Access Grant** — a DEPA-inspired consent artifact — instead of a
raw download link, and the whole thing is wrapped in an **MCP server** so an LLM agent can transact on
it in natural language.

## Why it exists (the idea worth building)

Every "data marketplace" hands you a download URL and trusts you forever. That has three problems:
the grant of access is **invisible** (nothing records *who* may use *what*, *why*, and *until when*),
**irrevocable** (once the URL leaks, consent can't be withdrawn), and **unscoped** (all-or-nothing).

BDC's contribution is to make the *act of granting access* a first-class, cryptographic object:

> **Access Grant** — a signed statement that *grantee G may use resource R from provider P, for
> purpose Y, under license class L, at scope S, until time T, and this grant is revocable.*

The provider never hands out data against a URL. It hands out data against a **verifiable grant** it
can check offline (signature, window, scope, provider, resource) and online (revocation) at the moment
of download. That is the whole thesis; everything else is the machinery that makes it real on an
interoperable protocol.

## The participants

| Component | Role | Beckn term | Walkthrough |
| --- | --- | --- | --- |
| **BAP** | Consumer gateway/orchestrator — fans search out, drives the transaction | Beckn Application Platform | [02_bap](./02_bap.md) |
| **BPP** (×3) | Provider — serves a catalog, honours grants at its download endpoint | Beckn Provider Platform | [03_bpp](./03_bpp.md) |
| **Access Manager** | The consent authority — issues, tracks, revokes grants | (DEPA consent manager) | [04_access_manager](./04_access_manager.md) |
| **MCP server** | Host-run bridge that lets an LLM agent drive the flow in natural language | — | [05_mcp](./05_mcp.md) |

The **Access Manager is deliberately separate from the BPPs**. In DEPA terms the data-holder (BPP) and
the consent-manager (AM) are different authorities: a provider serves data but does not decide consent;
the consent authority signs grants but holds no data. That separation is what makes "revocable" mean
something — revocation lives with the authority, not the data holder.

## The end-to-end lifecycle

One natural-language request — *"find me a permissively-licensed churn dataset and get me the data"* —
becomes this:

```
 Agent → MCP → BAP                BPPs                 Access Manager
   │      search ──discover(×3)──▶  │                        │
   │             ◀──on_discover──── │   (aggregated in a      │
   │                                │    time window)         │
   │      confirm ──select/init/confirm──▶ │                  │
   │                     ◀──on_confirm──── │                  │
   │             ────────── issue grant ──────────────────▶   │  signs a scoped
   │                     ◀──────── SignedAccessGrant ──────   │  Access Grant
   │      download ─── GET /download + grant ──▶ BPP          │
   │                     ◀──── data file (200) ─────          │  verify offline
   │      revoke   ──────────────── revoke ───────────────▶   │  + online (revocation)
   │      download ─── GET /download + grant ──▶ BPP 403      │  (now refused)
```

Two things are happening at once, and keeping them distinct is the key to understanding the code:

1. **The Beckn transaction** (`discover → select → init → confirm`) — an *asynchronous* protocol. A
   request returns only an `ACK`; the real answer arrives later as an `on_<action>` callback. The BAP
   correlates callbacks by `transactionId` inside a time window (see [02_bap](./02_bap.md)).
2. **The consent artifact** — at `confirm`, the BAP asks the Access Manager to mint a grant. That grant,
   not the contract, is what unlocks the download.

## Two independent cryptographic layers

Both are Ed25519 over canonical JSON, but they answer different questions — do not conflate them:

| Layer | Question | Signed by | Checked by | Code |
| --- | --- | --- | --- | --- |
| **Per-hop message auth** | *Who sent this Beckn message; is it fresh?* | the sending participant | the receiving participant | `crypto-utils/beckn-auth.ts` |
| **Access Grant** | *What may this consumer do; is that still true?* | the Access Manager | the BPP at download | `beckn-schemas/grant.ts`, `bpp/download.ts` |

Message auth stops an impostor from *speaking* on the network (forged/replayed `discover`, rogue grant
issuance). The grant stops even an authenticated party from *taking* data it has no consent for. Full
detail and threat model: [security.md](./security.md).

## Grant verification = offline + online

A subtle design point worth calling out. A signed grant is self-contained and independently verifiable —
but a self-contained token *cannot know it was later revoked*. BDC resolves this by splitting the check:

- **Offline** (no network call): signature, `notBefore`/`expiresAt` window, provider match, resource
  match, scope sufficiency — all verifiable from the grant bytes + the AM's public key.
- **Online** (one lookup): revocation, against the shared `grant_revocations` table the AM writes and the
  BPP reads.

Expiry bounds the blast radius of a leaked grant; revocation makes withdrawal immediate. Neither alone
is sufficient; both are enforced at every download (`bpp/src/download.ts` → `redeemGrant`).

## Code map

```
packages/
  crypto-utils/      canonical JSON, Ed25519 (sign/verify), Access Grant crypto,
                     per-hop message auth (beckn-auth.ts)
  beckn-schemas/     Zod schemas: Beckn context/envelope, DDM catalog/contract,
                     the Access Grant (grant.ts: issueGrant / verifyGrant)
services/
  bap/               orchestrator (fan-out + aggregation), client API, callbacks
  bpp/               config-driven provider: catalog, Beckn routes, grant-gated download
  access-manager/    grant issue / revoke / expiry sweep; the shared revocation table
  mcp-server/        host-run stdio bridge: gateway + session + 7 MCP tools
infra/               docker-compose (the network), key generators
seed-data/           synthetic catalogs + files (tabular / image / models)
```

Design conventions across every service: dependencies are **injected** (stores, transport, clock, auth)
so each app is exercised end-to-end in tests with in-memory fakes — no DB, no network, deterministic.
The store interface pattern (in-memory for tests, Postgres for runtime) recurs in the BPP and AM.

## Where to read next

- **The protocol itself** (verified against real payloads): [00_protocol.md](./00_protocol.md)
- **The consent artifact spec**: [consent-artifact-spec.md](./consent-artifact-spec.md)
- **The domain model** (dataset/model catalog schema): [domain-schema.md](./domain-schema.md)
- **The data contract** (external formats we integrated): [data-contract.md](./data-contract.md)
- **Security & threat model**: [security.md](./security.md)
- **Running the MCP demo**: [mcp-setup.md](./mcp-setup.md)
- **Per-component walkthroughs**: [02_bap](./02_bap.md) · [03_bpp](./03_bpp.md) ·
  [04_access_manager](./04_access_manager.md) · [05_mcp](./05_mcp.md)
