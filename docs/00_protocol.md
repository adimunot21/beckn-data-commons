# Phase 1 — Beckn Protocol Literacy (verified against real payloads)

> Everything here was captured from the **official Beckn v2.0.0 sandbox** (`fidedocker/sandbox-2.0`,
> repo [`beckn/sandbox`](https://github.com/beckn/sandbox), pushed 2026-07-07) driving the
> `nfh.global/testnet-ddm` domain. Raw captures live in
> [`protocol-samples/ddm/`](./protocol-samples/ddm/). Nothing here is assumed from the spec text —
> it is what the wire actually carries. Field-level meanings are in [`data-contract.md`](./data-contract.md).

## 0. The single most important finding

**Beckn v2.0.0 is NOT the snake_case v1 protocol `PROJECT_PLAN.md` was written against.** Two concrete
consequences that would have broken our parser had we coded from the spec doc:

| We assumed (v1 mental model) | Reality (v2.0.0, captured) |
| --- | --- |
| `context.transaction_id`, `message_id`, `bap_id`, `bpp_uri` (snake_case) | `context.transactionId`, `messageId`, `bapId`, `bppUri` (**camelCase**) |
| `domain` + `country`/`city` | `networkId` (e.g. `"nfh.global/testnet-ddm"`); no country/city |
| actions `search` / `on_search` | actions **`discover` / `on_discover`** |
| `message.catalog` (singular) | `message.catalogs` (**array**) |
| order object built across select/init/confirm | **`contract`** object, accreted DRAFT → ACTIVE |

This is exactly why the "inspect before integrating" rule exists. Our `@bdc/beckn-schemas` context
type must be camelCase v2.

## 1. The transaction context

Every message (request and callback) carries a `context`. Captured verbatim from `on_discover`:

```json
{
  "networkId": "nfh.global/testnet-ddm",
  "action": "on_discover",
  "version": "2.0.0",
  "bapId": "bap.example.com",
  "bapUri": "https://bap.example.com",
  "bppId": "bpp.example.com",
  "bppUri": "https://bpp.example.com",
  "transactionId": "550e8400-e29b-41d4-a716-446655440100",
  "messageId": "550e8400-e29b-41d4-a716-446655440102",
  "timestamp": "2025-02-15T10:00:01Z",
  "ttl": "PT30S"
}
```

- **`transactionId`** — stable across an entire discover→select→init→confirm journey. It is how a BAP
  correlates every provider's asynchronous replies back to the user request that started the journey.
- **`messageId`** — identifies one request/response *pair*. The ACK echoes it; the async callback
  echoes it. This is the correlation key for a single hop.
- **`action`** — the request action (`discover`); the callback flips it to `on_<action>`
  (`on_discover`). The sandbox controller literally does `action: \`on_${action}\``.
- **`ttl`** — ISO-8601 duration (`PT30S` = 30s), the validity window of the message. Basis for our
  replay-protection timestamp window in Phase 7.
- **`version`** — `"2.0.0"`.

## 2. The async ACK + callback pattern (verified live)

Beckn is **asynchronous**. A request does not return its result on the same HTTP response. We proved
this end-to-end locally (sandbox container → discover POST → our callback listener):

```
BAP ──POST /api/webhook/discover {context, message}──▶ BPP (sandbox)
BAP ◀──────── 200 {"message":{"status":"ACK","messageId":"…"}} ─────── BPP   (synchronous, immediate)

           … then, fire-and-forget, on a SEPARATE HTTP call …

BPP ──POST {bapUri}/on_discover {context: action=on_discover, message: {catalogs}}──▶ BAP callback
```

Captured evidence:
- **Synchronous body** of the discover POST: `{"message":{"status":"ACK","messageId":"cd4eff45-…"}}`
  — an ACK, *not* the catalog.
- **Asynchronous callback**: 7.2 KB `on_discover` POSTed to our listener at `/bpp/caller/on_discover`
  ([`on_discover.live-callback.json`](./protocol-samples/ddm/on_discover.live-callback.json)), with
  `transactionId`/`messageId` **echoed from our request** and `action` = `on_discover`.

**Architectural consequence for our BAP (Phase 4):** the BAP must (a) expose a callback endpoint, (b)
fan a `discover` out to N providers, (c) collect the `on_discover` callbacks that arrive *later* on
that endpoint, correlating by `transactionId`, and (d) close the collection window after a timeout
(the `ttl`). This is the Redis-backed aggregation window in the plan. A naive request/response HTTP
client will not work.

The sandbox's callback target is configurable via `BPP_CALLBACK_ENDPOINT`; it falls back to
`{bppUri}/bpp/caller/on_<action>`. Note the controller defensively reads both `bppUri` and `bpp_uri`
— real-world implementations are inconsistent about casing, another reason to normalize on ingest.

## 3. The DDM transaction: discover → select → init → confirm

| Request | Callback | `message` payload | `contract.status` | What it means |
| --- | --- | --- | --- | --- |
| `discover` | `on_discover` | `{ catalogs: [...] }` | — | Provider returns matching catalog(s): providers, `resources`, `offers` with rich dataset metadata. |
| `select` | `on_select` | `{ contract }` | `DRAFT` | A draft contract for the chosen offer(s): `commitments`, `consideration`, `participants`. No fulfillment yet. |
| `init` | `on_init` | `{ contract }` | `ACTIVE` | Firmed-up terms/participants. Still no `performance`. |
| `confirm` | `on_confirm` | `{ contract }` | `ACTIVE` | Adds **`performance`** (the fulfillment/access) and **`settlements`**. This is where access is granted. |

The **`contract`** object is the spine of the transaction and accretes fields as it progresses. The
actual *access to data* (`fulfillment:accessUrl`, validity window, download cap) appears **only at
`on_confirm`, inside `contract.performance[].performanceAttributes`**. See `data-contract.md` §3.

## 4. Signing (model; exact wire format to be verified before we implement)

The sandbox is an unsigned simulator, so signing was **not** in these captures. What we know of the
Beckn/ONIX model, to be confirmed against a real signed Fabric request **before** we write
verification code in Phase 3 (same inspect-first rule):

- Transport-level auth via an HTTP **`Authorization`** header (Beckn "Signature" scheme), **not** a
  field inside the JSON body. The body stays as captured above.
- **Ed25519** detached signature over a digest (Beckn uses BLAKE-512) of the raw request body, plus a
  `created`/`expires` window — this is the replay-protection basis.
- `keyId` identifies the signer as `subscriberId|uniqueKeyId|algorithm`, resolved to a public key via
  the **registry** (DeDi/Fabric). Key registration is a Phase-0/1 onboarding step still pending (needs
  interactive Fabric participant registration).

**Action item before Phase 3 crypto work:** capture one real signed request against hosted Fabric and
record the exact `Authorization` header grammar and digest inputs. Do not implement `@bdc/crypto-utils`
verification from spec prose alone.

## 5. Why this changes our strategy (read this)

There is now an **official Beckn DDM (Decentralised Data Marketplace)** effort:
[`beckn/DDM`](https://github.com/beckn/DDM) with published `DatasetItem` and `DatasetFulfillment`
schemas, referenced live by the sandbox. `PROJECT_PLAN.md` assumed no such reference existed. This is
good news, not bad:

1. **Align, don't reinvent.** Our `@bdc/beckn-schemas` catalog should map onto the official
   `DatasetItem` schema (`schema:*` + `dataset:*` attributes) so we are genuinely interoperable, not
   a lookalike. Details in `data-contract.md`.
2. **Our novelty sharpens.** The official DDM's access model is `fulfillment:accessUrl` — a bare URL
   with an embedded opaque token (`?token=eyJhbGci…HS256…SIGNATURE`), a validity window, and a
   download counter. It is **single-party, symmetric, non-revocable, and unverifiable by any third
   party** — the exact "raw download link with an expiry" our project argues against. The `beckn/DDM`
   README contains **no** notion of consent, grant, scope, revocation, or signing.
3. **Therefore the contribution is precise:** keep the official DDM catalog + contract for discovery
   and interop, but replace the `accessUrl` bearer pattern with a **DEPA-style Access Grant** — an
   Ed25519-signed, scoped, purpose-bound, expiring, *revocable* consent artifact issued by a separate
   Access Manager and verified at a grant-gated download endpoint. That separation (data holder vs.
   consent manager) and cryptographic revocability is what DDM does not have.

This is a stronger, more defensible framing than "no reference implementation exists": we extend the
official spec exactly where it is weakest.
