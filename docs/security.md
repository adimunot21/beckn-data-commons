# Security Model — Beckn Data Commons

BDC's whole premise is that **access to data is gated by a signed, scoped, revocable consent
artifact instead of a bearer URL**. That claim is only worth anything if the mechanisms behind it
actually hold up. This document is the threat model: what we defend against, how, where it is
enforced, and — just as important — what we explicitly do *not* yet defend against.

Security here is not a mode you can turn off. There is no "skip verification in dev" flag: the
service entrypoints refuse to boot without message-auth keys configured, and grant verification runs
on every download.

## Two independent cryptographic layers

| Layer | Question it answers | Primitive | Lives in |
| --- | --- | --- | --- |
| **Per-hop message auth** | *Who sent this Beckn message, and is it fresh?* | Ed25519 over canonical body + `created`/`expires`/`nonce` | `@bdc/crypto-utils` `beckn-auth.ts` |
| **Access Grant** | *What is this consumer allowed to do, and is that still true?* | Ed25519 over canonical claims + online revocation | `@bdc/beckn-schemas` `grant.ts`, BPP `download.ts` |

The layers are orthogonal. Message auth stops an impostor from *speaking* on the network; the grant
stops even an authenticated participant from *taking data* it has no consent for.

## Trust boundaries

```
 MCP client ──(local)──▶ BAP ──(signed Beckn)──▶ BPP ──▶ data file
                          │                        ▲
                          │(signed issue)          │(grant + revocation check)
                          ▼                        │
                    Access Manager ────────────────┘ (shared revocation table)
```

- **BAP → BPP** (`discover/select/init/confirm`) and **BPP → BAP** (`on_*` callbacks): every message
  is signed by the sender and verified against a trusted-key registry before it is acted on.
- **BAP → Access Manager** (`POST /grants`): signed by the BAP; the AM refuses to mint a grant for an
  unauthenticated requester.
- **Consumer → BPP** (`GET /download`): gated by a presented Access Grant, verified offline (signature,
  window, scope, provider, resource) and online (revocation).
- **MCP client → BAP** (`/search` etc.): treated as a *local* trust boundary (the client runs on the
  user's machine); rate-limited but not message-signed. In a hostile multi-tenant deployment this
  boundary would also require auth (see Limitations).

## Threat model

| # | Threat | Mitigation | Enforced at | Test |
| --- | --- | --- | --- | --- |
| 1 | **Impersonation** — an impostor posts a forged `discover`/`confirm` as the BAP, or a fake `on_confirm` as a BPP | Ed25519 signature over the canonical body; verifier resolves the sender's key from the registry | BPP request routes, BAP callback routes | `beckn-auth.test.ts`, `bpp/security.integration.test.ts` |
| 2 | **Replay** — a captured, validly-signed message is re-sent | Single-use `nonce` + short `created…expires` window; `ReplayCache` rejects a second use | verifier (`ReplayCache`) | `beckn-auth.test.ts` (replayed), `security.integration.test.ts` |
| 3 | **Message tampering** — body altered in flight | Signature is over the canonical body the verifier re-derives; any change breaks it | verifier | both auth suites (bad-signature) |
| 4 | **Rogue grant issuance** — a party asks the AM to mint a grant it should not have | AM verifies the issue request is signed by the trusted BAP | AM `POST /grants` | live-verified (401 unsigned); unit-covered by auth suite |
| 5 | **Forged / tampered grant** — attacker fabricates or edits grant claims | Ed25519 signature over canonical claims; BPP verifies with the AM's public key | BPP `download.ts` (`verifyGrant`) | `grant.test.ts` (bad-signature, malformed) |
| 6 | **Expired grant** — using a grant past its window | `notBefore`/`expiresAt` temporal check (offline), with bounded clock skew | BPP `download.ts` | `grant.test.ts`, `bpp/app.integration.test.ts` (expired) |
| 7 | **Scope / provider / resource abuse** — a grant for X used to fetch Y | `verifyGrant` checks requested resource/offer/fields against the grant's scope, provider, resource | BPP `download.ts` | `grant.test.ts` (scope-insufficient, wrong-provider, wrong-resource) |
| 8 | **Revoked grant** — consent withdrawn but the signed bytes still exist | Online revocation check against the shared `grant_revocations` table at redeem time; expiry bounds the blast radius, revocation makes it immediate | BPP `download.ts` + AM revoke | `bpp/app.integration.test.ts` (revoked), live-verified (revoke → 403) |
| 9 | **Store failure / double-spend mid-flow** | Postgres advisory lock around schema init; revocation check is **fail-closed** (a store error denies, never grants); redemptions are counted | BPP stores, `download.ts` | store + download tests |
| 10 | **Flooding / DoS** | `@fastify/rate-limit` (per-IP) + a 256 KB body limit on every service | all HTTP services | — (config) |
| 11 | **Secret leakage** | Private keys and DB creds only via env/`.env` (gitignored); generated key files (`infra/*.env`) never committed | deploy config | — |

## Known limitations (honest list)

These are real gaps, called out rather than hidden. Each has a clear mitigation path.

1. **Grants are bearer tokens.** Anyone who obtains the signed grant bytes can redeem them until they
   expire or are revoked — the BPP does not yet require the presenter to *prove* they are the grantee.
   *Mitigation path:* holder-of-key binding — bind `grantee.publicKey` into the grant and require a
   fresh proof-of-possession signature (over a server nonce) at download. Expiry + revocation already
   bound the damage today.
2. **Unauthenticated revoke.** `POST /grants/:id/revoke` is open. Because revocation only ever *denies*
   access, this is a denial-of-service risk, not privilege escalation. *Mitigation path:* require the
   grantee (or AM operator) to authenticate the withdrawal.
3. **Single-process replay cache.** `ReplayCache` is in-memory, correct for one instance. A
   horizontally-scaled BPP/BAP would need a shared cache (Redis, keyed `keyId:nonce` with TTL =
   expiry) — the code notes exactly this seam.
4. **No transport encryption in the demo.** Messages are signed but sent over plain HTTP on the local
   network. Production would run mTLS/TLS between participants; signing is orthogonal to and complements
   that.
5. **Static key registry.** Keys are wired via env with no rotation or revocation-of-keys story. A real
   network resolves participant keys from the Beckn registry with rotation.
6. **Local BAP client API is unauthenticated** (see Trust boundaries).

## Message-auth scheme (reference)

```
signingBase = `${keyId}\n${created}\n${expires}\n${nonce}\n${canonicalJson(JSON-normalized body)}`
signature   = Ed25519(signingBase, senderPrivateKey)                       // hex
Authorization: Signature keyId="…",algorithm="ed25519",
               created="<unixSec>",expires="<unixSec>",nonce="<hex>",signature="<hex>"
```

The header never carries the body — the verifier re-canonicalizes the body it actually received, so
tampering breaks the signature. The body is JSON-normalized before canonicalization so the signer and
a verifier (which only ever sees the parsed JSON) agree even when an optional field is `undefined`.
This is a clean, self-contained scheme *inspired by* Beckn's HTTP-Signature auth; it is intentionally
not a bit-for-bit reimplementation of a live-Fabric header grammar we have not captured.

## Operational notes

- Generate the network's message-auth keys: `node infra/gen-beckn-keys.mjs > infra/beckn-keys.env`.
- Generate the Access Manager's grant-signing keypair: `pnpm --filter @bdc/access-manager gen-keys`.
- Source both, then `docker compose up` — services fail fast if `BECKN_PRIVATE_KEY` / `BECKN_REGISTRY`
  (or the AM key) are missing. Never commit the generated `*.env` files.
