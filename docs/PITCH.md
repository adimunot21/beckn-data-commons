# The Pitch — Beckn Data Commons

> The full written product pitch: read it aloud, send it cold, or lift sections into a deck.
> Companion docs: [`PRODUCT.md`](./PRODUCT.md) (operating strategy), [`security.md`](./security.md)
> (threat model), the [live site](https://adimunot21.github.io/beckn-data-commons/).
> *(Product name pending — "Consentry" recommended; see PRODUCT.md §5.)*

---

## 1. One line

**Give AI agents governed access to your data in an afternoon — signed, scoped, revocable access
grants instead of API keys and download links.**

## 2. The elevator version (30 seconds)

AI agents are starting to fetch, license, and use data on people's behalf — and today they do it
with the crudest credentials the internet has: API keys pasted into config files and download URLs
with tokens baked in. Those credentials are invisible (no record of who or why), all-or-nothing
(no scope, no purpose, no license terms), and effectively irrevocable (leaked = gone until expiry).

We built the alternative: a drop-in gateway that puts every data access behind a **cryptographically
signed consent artifact** — an Access Grant naming *who* may use *what*, *why*, *how much*, and
*until when* — issued by a consent authority **separate from the data holder**, verifiable by anyone,
and **revocable in one action, effective on the very next request**. It speaks an open protocol
(Beckn), so gateways compose into a network. And it's agent-native: any MCP-speaking assistant can
drive the entire flow in plain English.

It exists, it works, and you can watch a grant get revoked live: **the demo ends with the exact same
download flipping from HTTP 200 to HTTP 403 the moment consent is withdrawn.**

## 3. Why now

Three curves are crossing:

1. **Agents became buyers.** Tool-using AI (MCP standardized this in 2024–25) means software now
   *transacts*: discovers, negotiates, retrieves. The volume and autonomy of machine-driven data
   access is about to dwarf human-driven access — and machine access at scale with bearer
   credentials is an accountability void.
2. **Data owners are cornered.** Every data vendor, labeling company, and API-data startup is
   fielding "can our agent use your data?" requests. Their choice today: say no (lose the deal) or
   hand over a key (lose control). Compliance teams are the bottleneck because nothing on the
   market lets them say yes safely.
3. **The open-network playbook is proven.** UPI showed that open protocol rails beat walled-garden
   apps for payments; ONDC is running the same play for commerce. Nobody has run it for the
   data-and-AI-access layer. The pattern for governed data sharing exists too — DEPA's
   consent-manager architecture — but it has only ever been applied to regulated finance/health
   flows, never to a data marketplace, and never agent-native.

The window: whoever defines how agents *legitimately* get data — before bearer-credential sprawl
calcifies into "how it's done" — owns a genuinely structural position.

## 4. The problem, concretely

A company with licensable data gets asked to let an AI agent use it. Their options today:

| Option | What breaks |
| --- | --- |
| Download URL / signed link | No record of who/why. Unscoped. Leaked = open until expiry. Unverifiable by anyone but the issuer. |
| API key | Same, plus keys rot in config files and get committed to repos. Revoking breaks *everything* using the key, not one consumer. |
| OAuth integration | Weeks of bespoke work per counterparty; tokens are platform-bound; scope granularity is coarse; only the issuer can validate. |
| Say no | The deal dies. This is what compliance usually picks. |

The missing primitive is a **portable, inspectable, revocable permission** — one that carries the
license terms with the access, works across organizations, and that a *third party* can verify
without phoning the issuer.

## 5. The solution

### The Access Grant

A signed JSON artifact — the permission slip made cryptographic:

```
claims:    who (grantee) · what (resource, provider) · why (purpose) ·
           how much (full / sample / named fields) · license class ·
           valid window · revocable · nonce
signature: Ed25519 over the canonical claims, by the Access Manager
```

- **Unforgeable & tamper-evident** — change one character, verification fails.
- **Independently verifiable** — any provider checks it offline with the issuer's public key: no
  callback, no shared secret.
- **Revocable** — the one thing a self-contained token can't know is handled by design: providers
  make one revocation-list lookup at redemption. Expiry bounds a leak; revocation ends it *now*.

### The architecture (DEPA's insight, productized)

The party that **holds** data is not the party that **grants** permission. Providers run a gateway
(the data holder); an independent **Access Manager** issues, records, and revokes grants. Withdraw
consent once, at the authority — every provider refuses the grant on the next request. That
separation is what makes "revocable" a guarantee instead of a promise.

### Agent-native, open-protocol

- **MCP server**: any compliant assistant (Claude et al.) can search, negotiate, obtain a grant, and
  download — in natural language, zero custom integration.
- **Beckn wire-compatibility**: every message between participants follows the open protocol that
  powers ONDC, and every hop is Ed25519-signed with replay protection. Gateways aren't point
  solutions; they're nodes of a future network.

## 6. Don't take our word — watch it

**Live site:** https://adimunot21.github.io/beckn-data-commons/
**The demo (5 clicks):** https://adimunot21.github.io/beckn-data-commons/demo/

Search fans out to three independent providers → confirm issues a real signed grant (decoded on
screen, signature and all) → the download returns **200** → revoke at the consent authority → the
identical download returns **403 revoked**. The static site replays a captured real run; boot the
stack locally (~10 min, one compose command) and every step runs live.

## 7. What's actually built (status: working product, pre-revenue)

- A complete network: consumer gateway (BAP), **three** independent provider gateways (BPPs),
  Access Manager, Postgres/Redis — one `docker compose up`.
- Full crypto layer: signed grants (offline verification + online revocation), per-hop Ed25519
  message auth, replay protection, rate limiting. Documented threat model **including an honest
  known-limitations list** with designed fixes (e.g., holder-bound proof-of-possession grants —
  the schema field already exists).
- **MCP server** (7 tools: search → view → request → confirm → download → list → revoke).
- **Web product**: landing, interactive demo, console (catalog, grants, one-click revoke), and a
  full docs site — including a 12-module from-scratch course on the entire problem space
  (protocols, DPI, consent, crypto, agents), which doubles as SEO and credibility.
- **117 automated tests**, CI green, production Compose + TLS deployment, verified end-to-end.
- All sandbox data is synthetic — zero licensing/personal-data exposure while we pilot.

## 8. Why we win (and why this is hard to copy)

1. **Architecturally correct, not a wrapper.** Separation of consent authority from data holder +
   offline/online verification is a *structural* property. An access-control feature bolted onto a
   storage product can't retrofit third-party verifiability or authority-independence.
2. **Network shape.** Every customer gateway speaks the same open protocol. Competitors selling
   point-to-point access control add integrations; we add *nodes*. At some density, discovery
   across gateways becomes the marketplace — a compounding asset no feature list matches.
3. **Agent-native distribution.** Listed where agents already look (MCP registries, npm). The
   consumers of the future find the network themselves.
4. **The education moat.** We literally wrote the course on consent-governed agent data access.
   Cheap for us, expensive to replicate, and it makes us the reference point for the category.
5. **Speed through depth.** One person built and secured the whole stack; the marginal cost of
   iterating is a fraction of a committee-run platform team's.

## 9. Market (the logic, not invented numbers)

We deliberately argue structure rather than cite a made-up TAM:

- **Wedge market**: every company whose *product or moat is data* and who faces agent demand —
  data vendors/aggregators (financial, geospatial, market), labeling/dataset companies, API-data
  startups, research institutions. Each deployed gateway is recurring infrastructure revenue.
- **Expansion**: internal agent governance (the same grant machinery for *inside-the-company* data
  access by agents), then the cross-provider network with transaction economics — the UPI/ONDC
  dynamic applied to data: infrastructure first, network effects second.
- **Reference points**: consent/data-sharing rails are already national-scale infrastructure in
  regulated domains (Account Aggregator ecosystem); MCP adoption turned "agent tooling" into a
  standard interface market in under two years. We sit at the intersection.

## 10. Business model

| Tier | Price | What |
| --- | --- | --- |
| Sandbox | Free | Public synthetic network — the demo, the top of funnel |
| Pilot | Free (60–90 days) | 2–3 design partners, their data, private gateway, weekly iteration |
| Growth | $99–$499 / gateway / month (anchor) | Managed Access Manager, audit trail, support; usage pricing (grants issued) once metering lands |
| Network (later) | Per-transaction | Cross-provider discovery & licensing once gateway density exists |

Pricing is an anchor to validate in pilots — infrastructure with a compliance buyer supports
value-based pricing well above these numbers if the audit trail becomes part of a customer's
compliance story.

## 11. Go-to-market (bootstrapped, sequenced)

1. **Now**: free static site + recorded demo (live), MCP server to npm + registries, launch posts
   (Show HN, MCP/agent communities, Beckn/ONDC ecosystem — direct affinity), course-as-SEO.
2. **Pilots**: 15–20 targeted outreach from the ICP; the offer is "governed agent access on your
   own data, free, 60–90 days, we iterate weekly." Convert 2–3. Their logos + audit-trail stories
   become the sales asset.
3. **First revenue**: pilot conversions at Growth pricing; provider onboarding kit makes deployment
   an afternoon, not a project.
4. **North star**: grants issued per week by people who aren't us.

## 12. Risks, answered honestly

| Risk | Our answer |
| --- | --- |
| MCP ecosystem churn | The MCP layer is deliberately thin over a stable HTTP API; re-targeting a new agent standard is days, not months. |
| A hyperscaler bundles "agent data governance" | They'll bind it to their platform. Our wedge is *cross-vendor* + third-party verifiability + open protocol — structurally what a platform won't build. Speed + pilots now. |
| "Beckn is India-centric" perception | We lead with the problem and the grant; the protocol is an appendix detail for Western buyers and a door-opener in the ONDC ecosystem. |
| Grants are bearer tokens today | Known, documented, bounded (short expiry + instant revocation), and the holder-binding fix (proof-of-possession) is designed with the schema field already in place — it's the first hardening wave. |
| Solo founder | The entire stack shipped, secured, tested, and documented in days, solo, with AI-accelerated engineering. The bottleneck is pilot conversations, not code. |
| "Consent theater" skepticism | We don't claim regulatory compliance; we demonstrate enforcement. The demo's 200→403 flip *is* the counter-argument. |

## 13. Team

Solo technical founder: strong Python/ML fundamentals, full-stack delivery of this entire system —
protocol implementation, applied cryptography, distributed services, agent tooling, product, and
docs. Portfolio-grade execution speed with production discipline (tests, CI, threat model).
First hires post-revenue: a design-partner-facing engineer and a GTM/content contractor.

## 14. The ask

**Right now: 2–3 design partners.** A company with licensable or shareable data and real agent
demand, willing to run a private gateway pilot for 60–90 days (free) and iterate with us weekly.
You get governed, auditable, revocable agent access to your data — and a say in the roadmap.
We get proof, feedback, and a case study.

**Talk to us:** adimunot21@gmail.com · https://adimunot21.github.io/beckn-data-commons/ ·
https://github.com/adimunot21/beckn-data-commons

---

## Appendix A — objection quick-answers

- **"Why not just OAuth?"** OAuth tokens are platform-bound, issuer-validated only, coarse-scoped,
  and take a bespoke integration per counterparty. A grant is portable across organizations,
  third-party-verifiable offline, purpose-and-license-carrying, and revocable at an authority
  independent of the data holder.
- **"Why an open protocol instead of your own API?"** Because the endgame is a network, and
  networks need rails nobody owns. Also pragmatically: the Beckn/ONDC ecosystem is a warm,
  protocol-literate early market.
- **"What stops a customer self-building this?"** Nothing stops them building *access control*.
  The independent consent authority, cross-provider verifiability, agent-native distribution, and
  the eventual network are what they can't get from a weekend project — and our stack is open
  source, so "build" usually means "deploy ours."
- **"Is the data real?"** Sandbox data is synthetic by design (zero licensing exposure). Real data
  enters only in private pilots under a pilot agreement.

## Appendix B — technical summary (for the engineer in the room)

Beckn v2 network (camelCase, `discover→on_discover` async ACK+callback, aggregation windows) ·
DDM-aligned catalogs · Access Grants: Ed25519 over canonical JSON, offline checks (signature,
window, provider, resource, scope) + online revocation via a shared store · per-hop message auth
(signed Authorization headers, nonce replay cache) · TypeScript monorepo, Fastify, Zod validation
at every boundary, Postgres/Redis, Docker Compose + Caddy TLS · MCP server (stdio) · Next.js
product surface · 117 tests, CI, full threat model in `docs/security.md`.
