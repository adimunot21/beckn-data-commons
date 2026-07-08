# 02 · BAP — the consumer gateway & orchestrator

The BAP (Beckn Application Platform) is the consumer's entry point. A client (the MCP server, a UI, or
curl) calls its simple synchronous API — `/search`, `/select`, `/init`, `/confirm` — and the BAP does
the hard part: driving Beckn's *asynchronous* protocol against multiple providers and, at confirm,
obtaining a grant from the Access Manager.

`services/bap/src/` — no database; the BAP holds only short-lived in-flight state.

## The core problem it solves: async correlation

Beckn is asynchronous. When the BAP sends `discover` to a BPP, the BPP replies with only an `ACK`. The
real catalog arrives *later* as an `on_discover` POST to the BAP's own callback endpoint. Multiply that
by three BPPs answering at different times and you need to (a) fan a request out, (b) collect the
callbacks that belong to this transaction, and (c) stop waiting at some point.

`orchestrator.ts` is that machine:

- **Correlation key**: `` `${transactionId}:${action}` ``. Every outbound request registers a *pending*
  collector under this key; each inbound callback (`deliverCallback`) looks up the same key and appends
  its response.
- **Aggregation window**: `fanOut` resolves when it has collected `expected` responses **or** the window
  (`aggregationWindowMs`) elapses — whichever comes first. Slow or dead BPPs simply don't contribute;
  the search still returns.
- **`search`** fans `discover` to all BPPs and flattens the returned catalogs. **`select`/`init`/`confirm`**
  target a single chosen BPP (`expected = 1`); if no callback arrives in the window they throw
  `TimeoutError` (mapped to HTTP 504 by the app).

This in-memory registry is correct for our single-instance topology. The code notes the seam where a
horizontally-scaled BAP would move the pending registry to Redis under the same key scheme.

## Confirm: where the transaction becomes consent

`orchestrator.confirm` is the pivot of the whole system. It:

1. runs the Beckn `confirm` against the chosen BPP (producing the contract), then
2. calls the Access Manager (`amClient.issue`) with the grantee, provider, resource, scope, license
   class, and purpose — and returns both the `contract` and the resulting `SignedAccessGrant`.

The grant, not the contract, is what the consumer later presents to download. This is the line where
"I agreed to terms" becomes "here is a cryptographic artifact proving what I may do."

## Signing every hop

Per-hop message auth ([security.md](./security.md)) is wired here without touching the orchestration
logic, thanks to dependency injection:

- `OrchestratorDeps.signOutbound` signs each outbound Beckn envelope; `fanOut` attaches it as the
  `Authorization` header via the transport.
- `httpAmClient(url, sign)` signs the grant-issue request so the AM knows it is really the BAP asking —
  no rogue issuance.
- `app.ts` verifies inbound `on_*` callbacks (`verifyCallback`) and returns **401** before a forged or
  replayed callback can poison an aggregation window.

`index.ts` builds this with `createParticipantAuth` and **refuses to boot** without `BECKN_PRIVATE_KEY`
+ `BECKN_REGISTRY` — there is no unauthenticated mode.

## Files

| File | What it holds |
| --- | --- |
| `config.ts` | env → `BapConfig`; `parseBpps("id=uri,…")` builds the fan-out target list |
| `transport.ts` | `BppTransport` + `AmClient` interfaces; `httpBppTransport`, `httpAmClient(url, sign?)` |
| `orchestrator.ts` | `BapOrchestrator`: fan-out, aggregation window, `deliverCallback`, `confirm` |
| `app.ts` | Fastify: client API (`/search…/confirm`), Beckn callbacks (`/on_*`), rate limit, callback auth |
| `index.ts` | wiring: real transport + AM client + participant auth; fail-fast on missing keys |

## How it's tested

`orchestrator.test.ts` injects a **fake `BppTransport`** that immediately drives callbacks back through
`deliverCallback`, plus a **fake `AmClient`** — so the full fan-out / aggregation / timeout / confirm
logic is unit-tested deterministically with a short window and no network. `app.integration.test.ts`
drives the real Fastify app via `inject`. Auth is an injected dependency, so these tests isolate
orchestration; the enforcement itself is proven in `crypto-utils` and the BPP security test.

## Reading order

`config.ts` → `orchestrator.ts` (the interesting part: `fanOut`, `deliverCallback`, `confirm`) →
`app.ts` → `index.ts`.
