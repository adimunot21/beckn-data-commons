# Product Strategy — from Beckn Data Commons to a go-to-market product

> Status: **active strategy doc**, drafted 2026-07-10. This is the operating plan for turning the
> completed BDC system into a commercial product. Technical docs live in [`docs/`](./01_architecture.md);
> this doc is about the business.

## 1. The product in one line

> **"Give AI agents governed access to your data in an afternoon."**

A drop-in gateway that lets AI agents discover, license, and download a company's data under
**signed, scoped, revocable access grants** — with a full audit trail — instead of API keys and
download links.

## 2. Positioning: infrastructure wedge → network endgame

We do **not** launch as a marketplace (no supply-side chicken-and-egg, no data-licensing liability).
We launch as **B2B infrastructure**: a customer deploys our provider gateway (the config-driven BPP +
Access Manager) in front of *their* data. Their compliance team gets consent artifacts, revocation,
and an audit trail; their business gets to say **yes** to agent access instead of no.

The network is the endgame, not the entry: every deployed gateway speaks the same open protocol
(Beckn). Once enough gateways exist, cross-provider discovery — the marketplace — emerges from
infrastructure we've already sold. Same playbook as payments rails before payment apps.

## 3. Problem & ICP

**Problem.** Companies are wiring AI agents to data with bearer credentials (API keys, signed URLs,
OAuth tokens copy-pasted into agent configs). That access is invisible (no record of who/why),
unscoped (all-or-nothing), and effectively irrevocable (leaked = gone). Compliance and data-platform
teams are the blockers on every "let the agent use our data" request — because nothing on the market
lets them say yes safely.

**Initial ICP (design-partner targets):**

1. **Data vendors / aggregators** (financial, geospatial, market data) — their product *is* licensed
   data; agent demand is arriving and their licensing model can't survive bearer URLs.
2. **Data-labeling / dataset companies** — sit on many datasets with per-customer licensing terms.
3. **API-data startups** — already sell governed access; agent-native governance is an upsell they
   can't build themselves.
4. **ONDC / Beckn-ecosystem companies** — already believe in open networks; zero protocol education
   needed.
5. **Research orgs / universities** — data-sharing agreements are their daily pain (later; slow sales).

**Buyer:** head of data platform / CTO at a 10–200-person data company. **Champion:** the engineer
told to "make agent access work"; **approver:** whoever owns compliance risk.

## 4. Why us (moat narrative)

- **Correct architecture, not a wrapper:** DEPA-pattern separation (data holder ≠ consent authority),
  Ed25519-signed grants, offline+online verification, per-hop message auth, replay protection — built
  and tested (117 tests), documented in a full [threat model](./security.md).
- **Agent-native from day one:** MCP server published where agents already look.
- **Open-protocol interop:** Beckn wire-compatibility means gateways compose into a network — a
  structural story competitors selling point-to-point access control don't have.
- **Education as distribution:** the [from-scratch course](../course/README.md) is a ready-made SEO
  and credibility asset ("the people who teach consent-governed agent access").

**Honest risk register:**

| Risk | Mitigation |
| --- | --- |
| MCP ecosystem churn (spec/registries move fast) | thin MCP layer over a stable HTTP API; adapters are cheap |
| Platforms bundle "governed agent access" | our wedge is *cross-vendor* + auditability + open protocol; move fast on pilots |
| Beckn brand reads India-only to Western buyers | lead with the problem and the grant, mention protocol in the appendix |
| Solo-founder bandwidth | waves are strictly sequenced; nothing ships half-hardened to a pilot |
| "Consent" reads as compliance-theater | the demo *shows* revoke→403 live; proof over promise |

## 5. Name & domain

"Beckn Data Commons" stays as the open-source project name. The product gets a market-facing name.
Availability checked via RDAP on 2026-07-10 — **every `.com` below is taken; every `.io` is
AVAILABLE** (~$35–40/yr at Cloudflare Registrar):

| Name | Reading | .io status | Note |
| --- | --- | --- | --- |
| **Consentry** ⭐ recommended | consent + sentry/entry — "the sentry that governs consent" | **available** | describes the product exactly; verb-adjacent ("put Consentry in front of it") |
| **Grantway** ⭐ runner-up | the way grants flow; gateway pun | **available** | warm, infrastructure-sounding |
| Grantic | grant + -ic | available | short, brandable, vaguer |
| Covena | covenant | available | elegant, needs explaining |
| Datagrant | literal | available | clear but generic, weak trademark |
| Grantable | adjective | available | reads as a feature, not a company |

**[YOU]** pick one and register the `.io` (Cloudflare Registrar, at-cost). Until then, code and docs
use the placeholder `PRODUCT_NAME`; renaming is confined to the web app + docs headers by design.

## 6. Pricing (draft — exists to anchor pilot conversations, not to bill)

| Tier | Price | What |
| --- | --- | --- |
| **Sandbox** | free | public synthetic-data network; the demo and the top of funnel |
| **Pilot** | free, 60–90 days | 2–3 design partners, their data, private gateway, weekly feedback call, signed pilot agreement |
| **Growth** (post-pilot placeholder) | $99–$499 / deployed gateway / mo | managed Access Manager + audit trail + support; usage pricing (grants issued) added once metering exists |

No Stripe, no billing code until a pilot wants to convert (Wave 4). The price exists so pilots know
what they're piloting toward.

## 7. GTM motion (bootstrapped solo)

1. **MCP-directory distribution** — publish the MCP server to npm (`npx <name>-mcp`), list in MCP
   registries and awesome-lists. High-intent, zero-cost channel; agents' owners find *us*.
2. **Content/SEO** — the course becomes the site's education section; each module is a landing page
   for a concept people are starting to search for ("revocable agent data access", "consent artifact").
3. **Launches** — Show HN ("I built a consent-governed data gateway for AI agents"), Product Hunt,
   MCP/agent Discords, **Beckn/ONDC community** (direct affinity), build-in-public thread.
4. **Design-partner outreach [YOU]** — 15–20 named companies from the ICP list; the offer: free pilot,
   they get governed agent access + audit trail on their own data, we get feedback, a logo, and a case
   study. One page + Cal.com link; no deck needed.
5. **The demo closes** — everything routes to `/demo`: watch a real signed grant get issued, decoded on
   screen, used to download, revoked, and refused. Proof over promise.

**North-star metric:** grants issued per week by people who aren't us.
**Funnel:** unique visits → demo flows completed → pilot calls booked → pilots signed → gateways
deployed.

## 8. Legal-light (pilot stage)

- ToS + privacy policy (template-generated), linked in the site footer.
- `docs/legal/pilot-agreement.md` — short mutual pilot agreement (no fees, confidentiality, data stays
  the provider's, either side can terminate, no warranty).
- Site carries a clear "**sandbox data is synthetic**" notice.
- No claims of DEPA/Account-Aggregator regulatory compliance — we use the architectural pattern; the
  scope note in [`PROJECT_PLAN.md`](../PROJECT_PLAN.md) §1 is the canonical wording.
- Real customer data only ever inside a signed pilot.

## 9. Execution roadmap (waves)

| Wave | Deliverable | Gate |
| --- | --- | --- |
| **0** | this doc · name availability · `apps/web` scaffolded into the workspace + CI | workspace gate green with the web app |
| **1** | **the visible product**: landing page, `/demo` interactive sandbox (search → grant decoded → download 200 → revoke → 403 in the browser), docs/course rendering, basic console (catalog, my grants, one-click revoke), prod compose + Caddy wiring | full demo flow clickable in a browser against the sandbox network |
| **2** | **pilot-ready hardening** (all pre-scoped in [`security.md`](./security.md)): org API keys on the BAP client API, authenticated revoke, proof-of-possession grants (holder-bound, not bearer), append-only audit trail + console view, backups/monitoring | security.md limitations #1–#2 closed; audit view live; new tests green |
| **3** | **pilot kit**: provider gateway as a published Docker image + `PROVIDER_GUIDE.md` ("expose your data in an afternoon"), MCP server on npm, pilot agreement, outreach one-pager | a stranger can stand up a provider gateway from the guide alone |
| **4** | post-pilot: Stripe billing, network/marketplace narrative, NLU differentiator if pilots value it | first paying gateway |

**[YOU] checklist (cash + accounts, ~$40/yr + ~$5–8/mo):** pick name → register `.io` → VPS
(Hetzner/DO) → Clerk (free tier) → Cal.com (free) → UptimeRobot (free) → Cloudflare email routing →
outreach list of 15–20 targets.

## 10. What we are explicitly NOT doing now

Real-data public listings (design partners only) · billing before a pilot converts · mobile apps ·
multi-region self-serve SaaS · compliance certifications (SOC2 etc.) · paid ads.
