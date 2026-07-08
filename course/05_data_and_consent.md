# 05 · Data & Consent

## Learning objectives

After this module you'll be able to explain:

- Why **data is a fundamentally different thing to trade** than a physical product.
- The three concrete failures of the **download-link** model of access.
- What **"consent as infrastructure"** means, and the **DEPA** idea behind it.
- The DEPA cast of characters: **data holder**, **consent manager**, **data consumer**, and the
  **consent artifact** — and *why separating the data holder from the consent manager is the key move*.
- What belongs in a good permission slip: **who, what, why, how much, until when, revocable**.

This is the conceptual heart of the whole project. Take your time here.

## Data isn't shoes

Most commerce is about physical goods. If I sell you shoes, I no longer have them; you can't
instantly make a million copies; and once they're yours, "revoking" the sale is meaningless. Markets,
contracts, and trust all quietly assume these properties.

**Data breaks all of them:**

- **It's infinitely copyable.** Giving you a dataset doesn't cost me my copy. Once you have it, you can
  copy it endlessly — so "access" is not a one-time hand-off, it's an ongoing relationship that might
  need conditions.
- **It's often sensitive.** Data can be about *people*. Who may use it, and *for what purpose*, isn't a
  nicety — it can be a legal and ethical requirement.
- **It comes with terms.** "Research use only." "No redistribution." "Attribution required." These
  license terms are part of the thing, and they need to travel *with* the access.

So the question "how do I give someone access to data?" is genuinely harder than "how do I sell shoes?"
The naive answer — hand over a link — quietly ignores everything that makes data special.

## The download-link problem

Recall the standard way access works online (and the way plain Beckn would do it too): the provider
hands over a **download URL**, often with a secret token baked in and an expiry date. It's convenient,
and it's the model this whole project argues against. Three failures, concretely:

1. **It's invisible / unaccountable.** The URL doesn't record *who* was granted access, *for what stated
   purpose*, or under *which license*. The permission has no memory. If a regulator, or the data's
   original owner, later asks "who has access to this and why?", there's no answer — just a URL that
   happens to work.

2. **It can't be revoked.** This is the big one. Once the URL is out — forwarded, pasted, cached, logged
   — *anyone holding it can pull the data*, and there is no "undo." The provider cannot say "actually,
   withdraw that consent now." The only thing that ever stops a leaked link is its expiry date, which
   might be far away. Consent you can't withdraw isn't really consent.

3. **It's all-or-nothing (unscoped).** The link works or it doesn't. It can't express "you may access a
   *sample* but not the full set," or "these three columns, not the other twenty," or "you agreed to
   *research* use." The nuance that data *needs* simply can't be attached to a URL.

A concrete note from this project: there's now an official Beckn extension for data marketplaces (called
**DDM**), and its access model is exactly this — a URL with an embedded opaque token, a validity window,
and a download counter. It is, in the project's own words, *"single-party, non-revocable, and
unverifiable by any third party."* That gap is precisely what Beckn Data Commons sets out to fix.

## Consent as infrastructure

The fix is to stop treating permission as a side-effect of a URL and start treating it as **its own
first-class thing** — a recorded, checkable, revocable object, managed on its own rail. This is the idea
of **consent as infrastructure**: the same unbundling move from Module 3, applied to permission.

Where does this idea come from? From a real framework called **DEPA**.

## DEPA — the pattern we borrow

**DEPA** (Data Empowerment and Protection Architecture) is an approach, pioneered in India for regulated
financial and health data, for sharing data *under the individual's control*. Its central, powerful move
is a **separation of roles**:

| DEPA role | What it does | In Beckn Data Commons |
| --- | --- | --- |
| **Data holder / provider** | Holds the actual data; serves it *only* when shown valid permission | The **BPP** (seller app) |
| **Consent manager** | Issues, records, and *revokes* permission — but **holds no data itself** | The **Access Manager** (a separate service!) |
| **Data consumer** | The party wanting access | The **grantee** — our user, or their AI agent |
| **Consent artifact** | The permission slip itself: a structured, signed record of what was allowed | The **Access Grant** |

Read the second row again, because it's the whole trick:

> **The party that holds the data is *not* the party that grants permission.**

Why does that separation matter so much? Because it's what makes "revoke" *mean* something. If the data
holder also issued permission, "revoking consent" would be them promising to police themselves. By
splitting the roles, permission is granted and revoked by an **independent authority** (the consent
manager), and every data holder simply *checks with that authority* before serving. Withdraw consent at
the manager, and *every* holder must honor it. This is DEPA's insight, and it's the architectural spine
of our system.

**A careful scope note (important and honest):** this project *borrows DEPA's architectural pattern* —
the separation of data holder from consent manager, and the idea of a consent artifact. It does **not**
implement or claim compliance with India's actual regulated Account Aggregator framework, which governs
real personal financial/health data under specific law. Every dataset in the project is **synthetic**, to
sidestep any real personal-data question entirely. We're reusing a *good idea*, not operating a regulated
system.

## What belongs in a good permission slip

If permission is going to be a real object, what should it record? Six things — remember them as
**who / what / why / how much / until when / revocable**:

| Question | Field | Example |
| --- | --- | --- |
| **Who** may use it? | grantee | "agent acting for user X" |
| **What** exactly? | resource | "the churn dataset, offer #4, from provider P" |
| **Why**? (the purpose) | purpose | "train a churn model" |
| **How much**? (the scope) | scope | "the full set" / "a sample" / "only these columns" |
| **Until when**? | expiry | "valid for 1 hour" |
| Can it be **taken back**? | revocable | "yes" |

That list *is* the Access Grant, essentially. In Module 6 we'll see how cryptography makes this slip
**unforgeable** and **checkable by anyone**; in Module 7 we'll see the exact object and its lifecycle.

## Why this beats the alternative

A download link answers exactly *zero* of the six questions above and can't be revoked. A DEPA-style
consent artifact answers all six, is issued by an independent authority, and can be revoked at any time —
turning "access to data" from an invisible, permanent, all-or-nothing URL into a visible, bounded,
revocable, accountable *agreement*. For data — copyable, sensitive, licensed — that's not a luxury; it's
the difference between a real consent model and a fig leaf.

## Where this lives in the project

- The full spec of the permission slip is
  [`docs/consent-artifact-spec.md`](../docs/consent-artifact-spec.md) — you can now read its opening and
  recognize every idea.
- The independent consent authority is `services/access-manager/`
  ([`docs/04_access_manager.md`](../docs/04_access_manager.md)).
- The data holders that *check* permission before serving are the BPPs
  ([`docs/03_bpp.md`](../docs/03_bpp.md)).

## Check your understanding

1. Give two ways data is fundamentally different from a physical good, and why each makes "just send a
   link" inadequate.
2. Name the three failures of the download-link model.
3. In DEPA, why is it essential that the **consent manager** is a *different party* from the **data
   holder**?
4. List the six things a good permission slip records (the who/what/why/how-much/until-when/revocable
   list).

<details>
<summary>Answers</summary>

1. Any two of: it's **infinitely copyable** (access is an ongoing relationship, not a one-time hand-off,
   so it may need conditions); it's often **sensitive/about people** (purpose and permission can be legal
   requirements); it carries **license terms** that must travel with access. A bare link ignores all of
   this.
2. It's **invisible/unaccountable** (records no who/why/license), it **can't be revoked** (a leaked link
   works until expiry), and it's **all-or-nothing/unscoped** (can't limit purpose, fields, or amount).
3. So that revocation is real: an **independent authority** grants and withdraws permission, and every
   data holder must check with it before serving. If the holder issued its own permission, "revoking"
   would just be it policing itself.
4. **Who** (grantee), **what** (resource), **why** (purpose), **how much** (scope), **until when**
   (expiry), and whether it's **revocable**.

</details>

## Key terms

**Data (properties)**, **download-link problem**, **DDM**, **consent as infrastructure**, **DEPA**, **data
holder**, **consent manager**, **data consumer / grantee**, **consent artifact**, **Access Grant**
(preview), **scope**, **purpose**, **revocable**. See the [Glossary](./GLOSSARY.md).

Next: **[06 · Just Enough Cryptography](./06_cryptography.md)** — how a permission slip becomes
impossible to forge.
