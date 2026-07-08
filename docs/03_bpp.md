# 03 · BPP — the provider & the grant-gated download

The BPP (Beckn Provider Platform) is the data holder. It answers Beckn requests about its catalog and —
the part that matters — **serves data only against a valid Access Grant**. One codebase runs as three
instances (tabular / image / models), each configured entirely by environment.

`services/bpp/src/` — Postgres-backed at runtime, in-memory in tests.

## One codebase, many providers

`config.ts` reads everything from env: the provider's Beckn id, which seed catalog JSON it serves, its
data directory, the Access Manager public key it trusts, and its message-auth keys. `infra/docker-compose.yml`
starts the same image three times with different env — no per-provider code. This is the "config-driven
BPP" the plan calls for, and it's what makes the network feel like a network rather than one service.

## The Beckn routes

`app.ts` registers `POST /discover`, `/select`, `/init`, `/confirm`. Each one:

1. **authenticates the sender** (`verifyRequest`) — a forged or replayed request is rejected **401**
   before any work;
2. validates the Beckn `context` with the Zod schema;
3. builds the `on_<action>` response via a pure builder (`beckn/builders.ts` — `buildOnDiscover`,
   `buildOnSelect`, `buildOnInit`, `buildOnConfirm`);
4. returns a synchronous `ACK`, then **fires the real `on_*` callback** to the BAP's callback URL,
   **signed** so the BAP can authenticate it.

The builders are pure functions of `(context, catalog, message)` → response, which is why they're
trivial to unit-test (`builders.test.ts`) with no server at all.

## The heart: `download.ts` → `redeemGrant`

`GET /download` is where the whole project's thesis is enforced. The consumer presents a grant via
`Authorization: Grant <base64url>` (`parsePresentedGrant`), and `redeemGrant` runs the two-part check
from [01_architecture](./01_architecture.md):

**Offline** (from the grant bytes + the trusted AM public key — no network):
- signature over the canonical claims (Ed25519),
- temporal window (`notBefore` / `expiresAt`) with bounded clock skew,
- provider match (this grant is for *this* BPP),
- resource / offer match (grant is for the thing being requested),
- scope sufficiency (e.g. a `subset` grant can't pull fields outside its list).

**Online** (one lookup):
- revocation, against the shared `grant_revocations` table.

Only if *all* pass does it stream the file. Every failure maps to a precise status/reason
(`bad-signature`/`expired`/`wrong-provider`/`wrong-resource`/`scope-insufficient` → 403,
`revoked` → 403, missing grant → 401). The revocation check is **fail-closed**: a store error denies
access, it never falls through to granting it.

## Stores

The store-interface pattern again (`stores/types.ts`):
- `RevocationStore` — reads the shared revocation table the AM writes.
- `RedemptionStore` — records redemptions (count surfaced via `x-bdc-redemption-count`).

`stores/memory.ts` backs the tests; `stores/postgres.ts` backs runtime. Schema init is guarded by a
Postgres **advisory lock** (key `728491`) so three BPPs booting concurrently don't race on
`CREATE TABLE` — a real bug found during Phase 3 and fixed there.

## Files

| File | What it holds |
| --- | --- |
| `config.ts` | env → `BppConfig` (identity, catalog, AM pubkey, message-auth) |
| `catalog.ts` | `BppCatalog.load/search/getOffer/resolveFile` |
| `beckn/builders.ts` | pure `buildOn*` response builders |
| `download.ts` | `redeemGrant` (offline+online), `parsePresentedGrant`/`encodePresentedGrant` |
| `stores/{types,memory,postgres}.ts` | revocation + redemption stores |
| `app.ts` | Fastify: Beckn routes + `/download`, request auth, callback signing, rate limit |
| `index.ts` | wiring: stores by `DATABASE_URL`, participant auth, fail-fast on missing keys |

## How it's tested

`app.integration.test.ts` drives the real app via `inject` and proves the full grant-gated flow **and**
the rejection bar: expired, wrong-scope, and revoked grants are all refused. `security.integration.test.ts`
proves per-hop auth enforcement (accept signed; reject missing / untrusted / tampered / replayed).
`download.test.ts` and `catalog.test.ts` cover the units.

## Reading order

`config.ts` → `catalog.ts` → `download.ts` (the important one: `redeemGrant`) → `beckn/builders.ts` →
`app.ts`.
