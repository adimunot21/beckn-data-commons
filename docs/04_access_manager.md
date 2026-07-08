# 04 · Access Manager — the consent authority

The Access Manager (AM) is the component that makes "signed, scoped, revocable" real. It holds the
Ed25519 key that BPPs trust, mints Access Grants at the BAP's request, records them, revokes them, and
sweeps expired ones. It holds **no data** — that separation from the data-holding BPPs is the DEPA
consent-manager pattern, and it's why revocation means something.

`services/access-manager/src/` — Postgres-backed at runtime, in-memory in tests.

## Why it's a separate authority

In a naive marketplace the provider decides who gets in. Here the provider (BPP) and the consent
authority (AM) are different actors:

- The **AM** signs grants but never serves bytes.
- The **BPP** serves bytes but never decides consent — it only *verifies* a grant the AM signed and
  checks the revocation table the AM writes.

So "withdraw consent" is a single authoritative action at the AM (revoke), and every BPP honours it at
the next download. No provider can keep serving a revoked grant, and no provider can mint one.

## Issuing a grant

`service.ts` (`GrantService.issue`) is the mint:

1. builds `AccessGrantClaims` (grantee, provider, resource, scope, license class, purpose,
   `transactionId`, `issuedAt`/`notBefore`/`expiresAt`, a nonce, `revocable`) — validated by the Zod
   schema in `beckn-schemas/grant.ts`, which `.refine()`s `notBefore ≤ expiresAt`;
2. signs the **canonical JSON** of the claims with the AM private key (`issueGrant`), producing a
   `SignedAccessGrant` (claims + `alg: 'ed25519'` + 128-hex signature);
3. stores the record so it can be listed and revoked.

Because the signature is over canonical JSON, any BPP reproduces the exact bytes and verifies with the
AM's public key (served at `GET /pubkey`) — no shared secret, no callback to the AM to verify a grant.

## Revocation — the shared table

`revoke` writes to the **`grant_revocations` table that the BPP reads**. This shared table is the entire
online half of grant verification. The Postgres store uses a transaction with `FOR UPDATE` so a
double-revoke resolves cleanly (`already-revoked` → 409). Revocation is intentionally cheap and
authoritative: one row, honoured everywhere.

Expiry is handled by a background **sweep** (`sweepExpired`, run on an interval in `index.ts`) that marks
grants whose window has passed — housekeeping so listings reflect reality; the BPP's own temporal check
is what actually blocks an expired grant at download time.

## Authenticated issuance

`app.ts` verifies (`verifyIssue`) that a `POST /grants` request is signed by the trusted BAP before
minting anything — closing rogue grant issuance. `index.ts` wires this from the shared registry and
**refuses to boot** without `AM_PRIVATE_KEY` and `BECKN_REGISTRY`.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /grants` | issue a grant (authenticated as the BAP) → 201 `SignedAccessGrant` |
| `GET /grants/:id` | grant status / record |
| `GET /grants?grantee=…` | a grantee's grant history |
| `POST /grants/:id/revoke` | revoke → 200 / 404 / 409 |
| `GET /pubkey` | the public key BPPs use to verify grant signatures |

## Files

| File | What it holds |
| --- | --- |
| `config.ts` | env → `AmConfig` (identity, `AM_PRIVATE_KEY`, ttl) |
| `service.ts` | `GrantService`: `issue` / `revoke` / `get` / `list` / `sweepExpired` |
| `stores/{types,memory,postgres}.ts` | `GrantStore` + the shared `grant_revocations` table |
| `app.ts` | Fastify endpoints, issue auth, rate limit |
| `index.ts` | wiring: derive pubkey, choose store, expiry-sweep interval, issue auth |

## How it's tested

`service.test.ts` covers issue → verify → revoke → the temporal/skew edge cases against in-memory
storage. `app.integration.test.ts` drives the HTTP surface (issue 201, revoke 200/404/409, pubkey).

## Reading order

`beckn-schemas/grant.ts` (the artifact itself) → `service.ts` (`issue`, `revoke`) → `app.ts` → `index.ts`.
