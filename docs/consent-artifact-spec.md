# Access Grant — Consent Artifact Specification

The **Access Grant** is Beckn Data Commons' consent artifact and the project's novel contribution. It
is a DEPA-inspired, Ed25519-signed, scoped, purpose-bound, expiring, **revocable** credential that
gates the actual download — replacing DDM's bare `fulfillment:accessUrl` bearer model.

Reference implementation: `packages/beckn-schemas/src/grant.ts` (schemas + issue/verify);
crypto in `packages/crypto-utils`. Format version: **`bdc-grant/1`**.

## 1. Why not just DDM's `accessUrl`?

DDM delivers access as `fulfillment:accessUrl` — a URL with an embedded opaque token, a validity
window, and a download counter (`docs/data-contract.md` §3). That model is:

- **single-party** — the data holder both issues and honors the token; no independent consent authority;
- **symmetric / unverifiable** — the embedded token (`HS256`-style) can't be checked by any third party;
- **non-revocable** — once the URL is out, only expiry stops it; there is no "revoke now";
- **unscoped** — no notion of *which fields*, *what purpose*, or *which grantee*.

The Access Grant fixes each of these while staying wire-compatible: our `accessUrl` points at a
grant-gated endpoint, and the grant token itself is the credential.

## 2. The DEPA-inspired separation

| DEPA role | BDC component |
| --- | --- |
| Data holder / provider | **BPP** (holds the dataset, serves the download, verifies grants) |
| Consent manager | **Access Manager** (issues, tracks, revokes grants) — *separate service, separate key* |
| Data consumer | **Grantee** (the agent/user, via the MCP layer) |
| Consent artifact | **Access Grant** (this doc) |

The BPP never mints its own access credential; it only *verifies* one issued by the Access Manager.
That separation is the point.

## 3. Grant format (`SignedAccessGrant`)

```jsonc
{
  "claims": { /* AccessGrantClaims — the signed body */ },
  "alg": "ed25519",
  "signature": "<128 hex chars: Ed25519 over canonicalJson(claims)>"
}
```

### `AccessGrantClaims`

| Field | Type | Meaning |
| --- | --- | --- |
| `v` | `"bdc-grant/1"` | Format version. |
| `grantId` | UUID | Unique id; also the **revocation-store key**. |
| `issuer` | string | Access Manager identity. |
| `issuerKeyId` | string | Signing key id: `subscriberId\|uniqueKeyId\|ed25519`. |
| `grantee` | `{ id, publicKey? }` | Who may redeem. |
| `provider` | `{ bppId, bppUri }` | The data holder that must honor it. |
| `resource` | `{ resourceId, offerId }` | Exactly what is authorized. |
| `scope` | `{ kind: full\|sample\|subset, fields?, maxDownloads? }` | How much. `subset` requires `fields`. |
| `licenseClass` | `permissive\|research-only\|no-redistribution` | Terms it is issued under. |
| `purpose` | string | DEPA "purpose" — stated reason for access. |
| `transactionId` | UUID | Links to the Beckn journey that produced it. |
| `issuedAt` / `notBefore` / `expiresAt` | int (unix seconds, UTC) | Temporal window. |
| `revocable` | boolean | Whether the issuer may revoke (revocation is checked online regardless). |
| `nonce` | string | Per-grant uniqueness / replay defense. |

**Signing:** the signature is Ed25519 over `canonicalJson(claims)` — deterministic key-sorted JSON
(`@bdc/crypto-utils`), so issuer and any verifier compute identical bytes. `grantSigningPayload()`
exports those exact bytes so the two sides can never drift.

## 4. Lifecycle

```
request ──▶ approve ──▶ issue ──▶ redeem (download) ──▶ expire
(select/init  (auto or   (AM signs   (BPP verifies)        │
 negotiates   manual)     grant)                           └─▶ revoke (any time, if revocable)
 scope/purpose)
```

1. **Request** — during `select`/`init` the grantee states resource, scope, and purpose.
2. **Approve** — auto (policy) or manual, per provider.
3. **Issue** — at `confirm`, the Access Manager signs an `AccessGrantClaims`, persists it (issued
   state) with its `grantId`, and returns the `SignedAccessGrant`.
4. **Redeem** — the grantee presents the grant to the BPP download endpoint. The BPP runs the
   two-part verification below before serving a byte.
5. **Expire** — past `expiresAt` (± clock skew) the grant is dead offline; an expiry sweep prunes the
   store.
6. **Revoke** — the Access Manager marks `grantId` revoked; the next redeem fails the online check
   even though the signature and window are still valid.

## 5. Verification — two parts, both required

`verifyGrant()` does the **offline** half and returns `requiresRevocationCheck: true` on success so
the download endpoint *cannot forget* the **online** half.

**Offline (in `verifyGrant`, no network):**
1. Structural parse (`SignedAccessGrant`) → `malformed`.
2. Signature over canonical claims vs. issuer public key → `bad-signature`.
3. Temporal window with clock-skew tolerance → `not-yet-valid` / `expired`.
4. `provider.bppId` matches the checking BPP → `wrong-provider`.
5. `resource.resourceId`/`offerId` matches the request → `wrong-resource`.
6. `subset` scope: requested fields ⊆ granted fields → `scope-insufficient`.

**Online (caller/BPP responsibility, against the shared revocation store):**
7. `grantId` not revoked.
8. `maxDownloads` (if set) not exceeded.

Rationale for the split: a self-contained signed grant is independently verifiable (no callback to the
Access Manager for signature/scope/expiry — the DEPA "artifact" property), but **it cannot know it was
revoked**. Expiry bounds exposure; the online revocation check makes revocation immediate. Neither
alone is sufficient — enforcing both is the security claim this project demonstrates.

## 6. Threat notes (expanded in Phase 7 `security.md`)

| Threat | Mitigation |
| --- | --- |
| Tampered claims (scope/expiry upgrade) | Signature over canonical claims — any change → `bad-signature`. (Tested.) |
| Replayed/leaked grant after revocation | Online revocation check at redeem; short `expiresAt`. |
| Grant reused at the wrong provider | `provider.bppId` bound + checked (`wrong-provider`). |
| Scope creep (asking for more fields) | `subset` field-set enforced (`scope-insufficient`). |
| Clock-skew false rejects | Bounded skew tolerance (default 30s); system clock sync checked in setup. |
| Forged issuer | Signature verified against the Access Manager's registered public key only. |
| Grant sharing between grantees | `grantee.id` bound in claims; Phase 7 adds grantee-key proof-of-possession. |

## 7. Status

Phase 2: schemas + offline verification + issue/verify implemented and tested
(`grant.test.ts`: tampered / expired / not-yet-valid / wrong-provider / wrong-resource /
scope-insufficient / malformed all rejected). The **online revocation store**, issuance at `confirm`,
and the grant-gated download endpoint are built in Phases 3–4.
