# 07 · Our System: Beckn Data Commons

## Learning objectives

This is where everything converges. After this module you'll be able to:

- Name the **participants** in Beckn Data Commons and map each to an idea you already learned.
- Describe the **Access Grant** — the star of the show — field by field.
- Walk the **full lifecycle**: search → confirm → grant → download → revoke → refused.
- Explain **why the Access Manager is a separate service** (the DEPA move) in terms that now feel
  obvious.

No new concepts here — just assembly. If a piece feels unfamiliar, the module that introduced it is
linked.

## The cast (and where each idea came from)

| Participant | What it is | You met the idea in |
| --- | --- | --- |
| **BAP** (buyer app) | Takes the user's/agent's intent, fans searches out, drives the transaction | Beckn roles — [04](./04_beckn.md) |
| **BPP** (seller app), ×3 | Each holds a catalog + datasets; serves data **only** against a valid grant | Beckn roles — [04](./04_beckn.md); data holder — [05](./05_data_and_consent.md) |
| **Access Manager** | The independent consent authority: issues, records, and revokes grants; **holds no data** | DEPA consent manager — [05](./05_data_and_consent.md) |
| **MCP server** | Lets an AI agent drive the whole thing in natural language | coming in [09](./09_mcp_and_agents.md) |
| **Access Grant** | The signed, scoped, revocable permission slip | consent artifact — [05](./05_data_and_consent.md); signatures — [06](./06_cryptography.md) |

The one-sentence definition, which should now fully make sense:

> **Beckn Data Commons is an open Beckn network for discovering and licensing ML datasets/models, where
> access is gated by a signed, scoped, revocable Access Grant — issued by a consent authority separate
> from the data holders — instead of a download link, and the whole thing is drivable by an AI agent
> through MCP.**

## The star: the Access Grant

Everything has been building to this object. The Access Grant is the permission slip from Module 5, made
unforgeable by the signatures from Module 6. It has two parts:

```
Access Grant
├── claims      ← the actual statement (the six questions, and more), as canonical JSON
└── signature   ← Ed25519 signature over those claims, made by the Access Manager
```

The **claims** are the human-meaningful content. Here are the important fields — notice they *are* the
who/what/why/how-much/until-when/revocable list from Module 5, plus bookkeeping:

| Field | Plain meaning | Module 5 question |
| --- | --- | --- |
| `grantId` | Unique id for this grant (also the key used to revoke it) | — |
| `issuer` / `issuerKeyId` | Which Access Manager signed it, with which key | (whose seal) |
| `grantee` | **Who** may use it | who |
| `provider` (`bppId`) | **Which data holder** must honor it | what |
| `resource` (`resourceId`, `offerId`) | **What** exactly is authorized | what |
| `scope` (`full` / `sample` / `subset` + fields) | **How much** — whole set, a sample, or only certain columns | how much |
| `licenseClass` | Terms it's issued under (e.g. permissive, research-only) | (the license) |
| `purpose` | **Why** — the stated reason for access | why |
| `issuedAt` / `notBefore` / `expiresAt` | The time window | until when |
| `revocable` | Whether it may be revoked | revocable |
| `nonce` | Use-once value for uniqueness/replay defense | — |

The **signature** is Ed25519 over the *canonical JSON* of those claims (Module 6). That single fact gives
the grant its superpowers:

- **Unforgeable** — only the Access Manager's private key could have produced it.
- **Tamper-evident** — change any claim (say, sneak `scope` from `sample` to `full`) and the signature no
  longer verifies.
- **Independently verifiable** — *any* BPP can check it using the Access Manager's public key, with no
  callback to the Access Manager. That's the DEPA "artifact" property.

You'll see a real one, decoded, in Module 11.

## The full lifecycle (the whole project in one flow)

Here is the entire system, start to finish. Every arrow is a request/response (Module 1); the Beckn steps
are from Module 4; the grant is from Modules 5–6.

```
 (1) SEARCH
     Agent → BAP → discover → all BPPs → on_discover → BAP aggregates catalogs
             "churn dataset, ≥2000 rows"        (async callbacks, Module 4)

 (2) NEGOTIATE + CONFIRM
     Agent → BAP → select / init / confirm → chosen BPP        (contract firms up)

 (3) ISSUE THE GRANT   ← the pivot
     BAP → Access Manager: "mint a grant: grantee, resource, scope, purpose…"
     Access Manager signs an Access Grant and returns it       (DEPA consent manager)

 (4) DOWNLOAD
     Agent → BPP  GET /download  (presenting the grant)
     BPP runs OFFLINE checks (signature, window, provider, resource, scope)
       + ONLINE check (is grantId revoked?)                    (Module 6 split)
     → all pass → 200, here is the data.

 (5) REVOKE
     User/Agent → Access Manager: "revoke grantId"             (writes the revoked list)

 (6) DOWNLOAD AGAIN
     Agent → BPP  GET /download  (same still-signed, still-unexpired grant)
     BPP's ONLINE check now finds it revoked → 403 Forbidden.
```

Step 6 is the money shot. The grant's signature is *still valid*. Its expiry *hasn't passed*. And yet the
data holder refuses — because consent was **withdrawn** at the independent authority, and the holder
checks that authority every time. That is exactly what a download link can never do, and it's what you'll
trigger yourself in Module 11.

## Why the Access Manager is a separate service

Now the DEPA separation from Module 5 should feel not just sensible but *necessary*. Ask: what if each
BPP issued its own grants?

- "Revoke" would mean each data holder promising to police itself — no independent guarantee.
- A grant from one provider couldn't be reasoned about by anyone else.
- There'd be no single, authoritative answer to "does this consumer still have consent?"

By making the **Access Manager** a distinct service with its *own* signing key, held apart from every
data holder:

- Grants are minted and revoked by **one independent authority**.
- Every BPP just **verifies** (offline) and **checks the shared revoked list** (online) — it never
  decides consent itself.
- Withdraw consent once, at the Access Manager, and *every* provider must honor it on the next download.

The two also don't blindly trust each other, thanks to Module 6: the BPP only honors grants signed by the
Access Manager's known public key, and the Access Manager only mints grants when *asked by the trusted
BAP* (a rogue party can't get a grant minted). Every hop is signed.

## Why this beats the alternative

Stack it against the download link one last time:

| | Download link | Access Grant (this system) |
| --- | --- | --- |
| Who/why recorded? | No | Yes (grantee, purpose, signed in) |
| Scoped? | No | Yes (full / sample / specific columns) |
| Revocable? | No — works until expiry | **Yes — immediately, at the authority** |
| Forgeable / alterable? | Token is opaque, unverifiable by third parties | Signed; tamper-evident; verifiable by anyone |
| Who controls access? | The lone data holder | An **independent** consent authority |

Same convenience (the agent still just "gets the data"), but access is now a visible, bounded, revocable,
cryptographically-sound agreement instead of an invisible permanent URL.

## Where this lives in the project

- The technical architecture overview: [`docs/01_architecture.md`](../docs/01_architecture.md).
- The Access Grant spec (every field, the lifecycle, the offline+online verification):
  [`docs/consent-artifact-spec.md`](../docs/consent-artifact-spec.md).
- The participants in code: `services/bap/`, `services/bpp/`, `services/access-manager/`, with
  walkthroughs [`docs/02_bap.md`](../docs/02_bap.md), [`docs/03_bpp.md`](../docs/03_bpp.md),
  [`docs/04_access_manager.md`](../docs/04_access_manager.md).

## Check your understanding

1. What are the two parts of an Access Grant, and what does the second part guarantee?
2. Walk the six-step lifecycle from memory, in one line each.
3. In step 6, the grant is still signed and unexpired, yet the download is refused. Why — and which check
   catches it?
4. Give two concrete things that break if the data holder issues its own grants instead of a separate
   Access Manager.

<details>
<summary>Answers</summary>

1. **claims** (the statement: grantee, resource, scope, purpose, expiry, revocable, …) and a
   **signature** over the canonical claims. The signature guarantees the grant is genuinely from the
   Access Manager and hasn't been altered (unforgeable + tamper-evident), and lets any BPP verify it
   independently.
2. Search (BAP fans discover to BPPs, aggregates) → negotiate/confirm (select/init/confirm with chosen
   BPP) → issue (BAP asks Access Manager, which signs a grant) → download (BPP runs offline+online checks,
   serves 200) → revoke (Access Manager marks the grantId revoked) → download again (BPP's online check
   finds it revoked → 403).
3. Because consent was **revoked** at the Access Manager after the grant was signed; the signed bytes
   can't know that. The **online** revocation check (a lookup at download time) catches it.
4. Any two: "revoke" becomes self-policing with no independent guarantee; other parties can't reason about
   the grant; there's no single authoritative answer to "does this consumer still have consent?"; consent
   can't be withdrawn network-wide in one action.

</details>

## Key terms

**Access Grant (claims + signature)**, **grantee**, **provider/BPP**, **resource**, **scope**,
**licenseClass**, **purpose**, **expiry**, **revocable**, **Access Manager**, **offline+online check**,
**every hop is signed**. See the [Glossary](./GLOSSARY.md).

Next: **[08 · The Infrastructure](./08_infrastructure.md)** — how all this actually runs on a computer.
