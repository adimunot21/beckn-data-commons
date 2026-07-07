# Beckn Data Commons (BDC)
### A Beckn-native, consent-governed dataset & model exchange — natively accessible to AI agents via MCP, with a locally fine-tuned NLU layer

---

## 1. Goal & Success Criteria

**Goal:** Build a real, deployed Beckn network where ML datasets and pretrained models are discovered, licensed, and accessed under a DEPA-inspired consent-artifact model (not a bare download link) — and make the whole thing transactable by any LLM agent through an MCP server, with the natural-language→Beckn-schema translation handled by a small model you fine-tune yourself.

**"Done" looks like:**
- [ ] At least 3 independent mock BPPs (data/model providers) and 1 BAP running, signing and verifying every message per Beckn spec (Ed25519).
- [ ] A full `discover → select → init → confirm → on_confirm` flow completes (Beckn v2.0.0 actions; see `docs/00_protocol.md`), ending in the Access Manager issuing a signed, scoped **Access Grant** (a consent artifact: purpose, scope, expiry, revocability) — not just a raw URL.
- [ ] A real download only succeeds when a valid, unexpired, correctly-scoped grant is presented; an expired or revoked grant is provably rejected.
- [ ] Open Claude (or any MCP client) → say "find me a small permissively-licensed tabular dataset for churn prediction, at least 2,000 rows" → agent searches, requests access, gets the grant, and actually retrieves the data — zero code written by the human in the loop.
- [ ] A fine-tuned local model (trained on RunPod) parses natural-language data requests into valid Beckn `discover` payloads, with a written comparison (accuracy / latency / cost) against GPT-4o-class function-calling on the same task.
- [ ] Everything deployed and reachable, with CI, tests, signed messages/grants, and a security write-up.

**Novelty check (why this hasn't been done):** *(revised after Phase 1 inspection — see `docs/00_protocol.md`)*
- An official **Beckn DDM (Decentralised Data Marketplace)** spec now exists ([`beckn/DDM`](https://github.com/beckn/DDM)): published `DatasetItem` and `DatasetFulfillment` schemas, live in the `fidedocker/sandbox-2.0` simulator. **We align to it** for genuine interop rather than inventing a parallel schema. Crucially, DDM defines discovery + fulfillment but its access model is a bare `fulfillment:accessUrl` — a bearer URL with an embedded opaque token, a validity window, and a download counter. It is single-party, symmetric, **non-revocable, and unverifiable by any third party**, and the spec has no notion of consent, scope, purpose-binding, or revocation.
- **Our contribution is precisely that gap:** a DEPA-style **Access Grant** — an Ed25519-signed, scoped, purpose-bound, expiring, *revocable* consent artifact issued by an Access Manager that is *separate* from the data-holding BPP — replacing DDM's bearer-URL trust model while staying wire-compatible with the `DatasetFulfillment` envelope.
- DEPA (the consent-manager/consent-artifact pattern behind India's Account Aggregator framework) has only ever been implemented for regulated financial and health data flows — nobody has adapted the *architectural pattern* (separating the party holding data from the party managing consent) to an ML dataset/model marketplace, and specifically not on top of Beckn DDM.
- The one public Beckn↔MCP bridge that exists is an admitted one-hour, unreviewed prototype for generic retail/mobility — no signing, no novel domain, no consent layer, no evaluation.
- The differentiator is the combination — Beckn DDM (transport/discovery, interop) + a DEPA-style *enforceable, revocable* consent artifact (the governance layer DDM lacks) + MCP and a locally fine-tuned parser (agent access) — plus a correct, signed, tested implementation.

**Important scope note:** we are borrowing DEPA's *architectural pattern* (data holder / consent manager / data consumer, consent artifacts) for a dataset/model marketplace — we are **not** implementing or claiming compliance with India's actual regulated Account Aggregator framework, which governs personal financial/health data under specific law. All datasets in this project are synthetic or self-generated to avoid any real-world licensing or personal-data question entirely.

---

## 2. Target Users / Use Case

Primary use case: portfolio/research piece proving you can (a) implement a real interoperability protocol correctly and securely, (b) design an enforceable consent layer on top of the official Beckn DDM schema — the part DDM leaves open — (c) bridge it to agents the right way (signed, tested, documented), and (d) run a legitimate applied-ML experiment on top.

Real-world angle if you ever wanted to extend it: ML teams currently discover datasets/models through scattered registries (HuggingFace Hub, Kaggle, data broker sites) with no standard machine-readable licensing/consent metadata and no way for an *agent* to safely negotiate access on a human's behalf. A Beckn-based data commons would let any front-end (chat, IDE plugin, agent) plug into the same open network of providers.

---

## 3. Hardware & Budget Constraints

| Component | Where it runs | Why |
|---|---|---|
| BAP, BPPs, Access Manager, MCP server, Postgres, Redis | Your Legion (Docker Compose) | Lightweight services, no GPU needed, fast iteration |
| Registry / Fabric | Hosted (`fabric.nfh.global`) for early phases; self-hosted registry as a stretch goal later | Avoids reinventing registry infra before you understand it |
| NLU model fine-tuning (LoRA) | RunPod (rented GPU, e.g. A40/RTX4090 pod) | 4GB GTX 1650 is workable for inference but tight for fine-tuning with eval headroom |
| NLU model inference (post-training) | Your Legion, local GPU, quantized (GGUF/AWQ) | 0.5–1.5B model fits comfortably in 4GB VRAM once quantized |
| Final deployment (demo) | Small VPS or Fly.io/Render (BAP/BPP/Access Manager/MCP) + local or small RunPod pod for NLU inference | Keeps the demo reachable without a GPU pod running 24/7 |

**Estimated RunPod spend:** a few short LoRA training runs on a 1–3k example synthetic dataset, ~1B-class model — expect **$5–20 total**, sized precisely in Phase 6.

---

## 4. System Architecture

```
                         ┌─────────────────────────┐
                         │   Beckn Fabric (hosted)  │
                         │  DeDi Registry + routing │
                         └────────────┬────────────┘
                                      │ signed Beckn msgs
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
        ┌─────▼─────┐          ┌──────▼──────┐         ┌──────▼──────┐
        │    BAP     │◄────────►│ BPP: Tabular│         │ BPP: Vision  │  ...more BPPs
        │ (Data Commons│  ONIX  │  datasets   │         │ datasets +   │  (e.g. small
        │  gateway)   │ signing │             │         │ small models │   pretrained
        └─────┬──────┘          └─────────────┘         └─────────────┘   model provider)
              │ internal REST
        ┌─────▼──────┐        ┌───────────────┐
        │   Access    │        │  NLU service  │
        │  Manager    │        │ (fine-tuned   │
        │ (consent    │        │  Qwen/Llama,  │
        │  artifacts, │        │  FastAPI)     │
        │  grants)    │        └───────▲───────┘
        └─────┬──────┘                │ intent parse
              │ validates on download  ┌───────┴───────┐
        ┌─────▼──────┐               │  MCP Server    │◄──── Claude / any MCP client
        │  Download   │               │ (tools: search, │      (natural language in,
        │  endpoint   │               │  request_access,│      dataset/grant out)
        │ (per BPP)   │               │  confirm, grants)│
        └────────────┘               └────────────────┘
```

**Data flow:** User asks Claude in natural language → MCP server (via local NLU model, or LLM tool-call fallback) produces a valid Beckn `search` message (task type, modality, license class, size) → BAP signs and sends to Fabric → Fabric routes to relevant BPPs → BPPs respond `on_search` with matching catalog items (metadata + sample preview, **not** the raw data) → user/agent selects one → `select`/`init` negotiate access purpose and scope → on `confirm`, the **Access Manager** issues a signed Access Grant (consent artifact: who, what scope, why, expiry, revocable) → the BPP's download endpoint validates the grant signature + expiry + scope before releasing the actual dataset/model file.

---

## 5. Technology Choices

| Choice | Alternative considered | Why this one |
|---|---|---|
| **TypeScript/Node.js** for BAP, BPPs, Access Manager, MCP server | Python (FastAPI) throughout | Beckn's own tooling (sandbox, starter-kit, ONIX) is TS-first; MCP TS SDK is first-class; one language across all Beckn-facing services keeps shared schema/crypto packages simple |
| **Zod** for Beckn context/message + consent-artifact schemas | Manual validation, JSON Schema + ajv | Type-safe at compile time *and* runtime-validated |
| **Postgres** for catalogs + grants | SQLite, Mongo | Grants need real transactional guarantees (issue/revoke/expire, no double-issuance) |
| **Signed, short-lived JSON grant tokens (Ed25519)** for the consent artifact | Plain OAuth-style opaque tokens | Needs to be independently verifiable by the BPP's download endpoint without a live call back to the Access Manager — a real bearer credential, matching the DEPA "consent artifact" idea |
| **Docker Compose** for local orchestration | k8s (kind/minikube) | Right-sized for a ~6-service local network |
| **Python + HF `transformers`/`peft`/`trl`** for fine-tuning | Axolotl, LlamaFactory | Most transparent for a from-scratch LoRA job; keeps ML code auditable for the write-up |
| **Qwen2.5-0.5B/1.5B-Instruct or Llama-3.2-1B-Instruct** as base model | Larger 7B+ model | Must run quantized on a 4GB GTX 1650 after training |
| **RunPod on-demand GPU** for training only | Local GPU training | Training needs headroom local VRAM doesn't comfortably have |
| **Ed25519** for message + grant signing | RSA | Matches Beckn's reference implementations and ONIX expectations |
| **Self-generated synthetic datasets** as catalog contents | Real public datasets | Removes all real-world licensing ambiguity — the project is about the protocol and consent mechanics, not dataset curation |
| **GitHub Actions** CI | none | Lint/test/build gate before every push |

---

## 6. Phase-by-Phase Breakdown

### Phase 0 — Environment Setup
- Repo scaffold, pnpm workspace (TS monorepo), Docker Compose skeleton, `.env.example`, GitHub repo (reminder: create it on github.com first).
- RunPod account + budget alert set.
- Beckn Fabric sandbox access confirmed (register test participant IDs).
- **Deliverable:** `docker compose up` boots empty services that health-check green.

### Phase 1 — Protocol Literacy (no product code yet)
- Stand up the official `fidedocker/sandbox-2.0` simulator against Fabric.
- Manually drive a full discover→confirm flow with Postman, reading every request/response.
- **Deliverable:** annotated Postman collection + a short internal doc on the async ACK/callback pattern, signing, and `context.transaction_id`/`message_id` semantics.

### Phase 2 — Domain & Consent-Artifact Design (the actual novel contribution)
- Define the BDC catalog schema: resource kind (`dataset` | `model`), task type, modality, record count/param count, license class (permissive / research-only / no-redistribution), format, size, sample preview, provenance note.
- Define the **Access Grant** (consent artifact) schema: grantee identity, scope (which fields/subset/full), stated purpose, issued-at, expiry, revocable flag, issuing BPP, signature.
- Define the grant lifecycle: request → (auto- or manual-)approve → issue → redeem-at-download → expire/revoke.
- **Deliverable:** `packages/beckn-schemas` (Zod types) + `docs/domain-schema.md` + `docs/consent-artifact-spec.md`.

### Phase 3 — Build the BPPs
- Generic, config-driven BPP service; spin up 3 instances seeded with different synthetic catalogs (tabular datasets, image datasets, small pretrained models).
- Implement `on_search`, `on_select`, `on_init`, `on_confirm`, grant-issuance hook, and the per-BPP download endpoint that validates a presented grant before serving the file.
- **Deliverable:** 3 running BPPs, independently testable via Postman, with unit + integration tests (vitest) including "expired grant rejected" and "wrong-scope grant rejected."

### Phase 4 — Build the BAP + Access Manager
- BAP: fan-out `search`, aggregate async `on_search` responses within a timeout window, orchestrate select/init/confirm.
- Access Manager: issue/track/revoke grants, expiry sweep job, grant-history endpoint.
- **Deliverable:** a full manual (Postman/CLI) end-to-end run — search a dataset, get a grant, successfully download, then revoke the grant and prove the same download now fails.

### Phase 5 — MCP Layer
- MCP server exposing tools: `search_resources`, `view_resource`, `request_access`, `confirm_access`, `list_my_grants`, `revoke_grant`, `download`.
- Test with Claude Desktop/Claude Code as the MCP client doing the full flow via natural language.
- **Deliverable:** a recorded/demoable session where a single chat request ends with real data in hand.

### Phase 6 — NLU Research Module
- Generate a synthetic dataset: natural-language data requests → correct Beckn `search` JSON (task, modality, license class, size constraints, purpose), covering paraphrase variety and ambiguity.
- LoRA fine-tune Qwen2.5-0.5B/1.5B-Instruct (or Llama-3.2-1B) on RunPod.
- Eval harness: accuracy (exact-match + schema-valid rate), latency, $-cost per 1000 requests — your fine-tuned local model vs. GPT-4o-class function calling on the identical test set.
- Wire the winner (or both, switchable) into the MCP server's parsing layer.
- **Deliverable:** `ml/eval/results.md` — a real comparison table, your standalone research contribution.

### Phase 7 — Security & Hardening
- Enforce signature verification on every hop, no dev-mode skip left on.
- Grant-token security: short validity window, scope enforcement at the download endpoint, revocation actually checked (not just expiry), replay protection on Beckn messages (timestamp window).
- Rate limiting, input validation, secrets in `.env`/RunPod secrets, never committed.
- Threat-model doc: malicious BPP, replayed signature, grant-sharing/exfiltration, ledger/grant-store failure mid-flow (idempotency).
- **Deliverable:** `docs/security.md` + passing security-focused tests.

### Phase 8 — Polish & Ship
- Deploy BAP/BPPs/Access Manager/MCP server to a small VPS or Fly.io/Render; NLU inference co-located or on a small always-on RunPod pod if latency demands it.
- README with architecture diagram, setup instructions, demo GIF/video.
- **Deliverable:** a public URL + repo someone else could clone and run.

### Phase 9 — Code Walkthrough Docs
- `docs/01_protocol.md`, `docs/02_bap.md`, `docs/03_bpp.md`, `docs/04_access_manager.md`, `docs/05_mcp.md`, `docs/06_nlu_research.md`.

---

## 7. Dependencies

| Library/Tool | Handles |
|---|---|
| `express` or `fastify` | HTTP servers for BAP/BPP/Access Manager/MCP server |
| `zod` | Runtime schema validation for Beckn messages + consent artifacts |
| `@noble/ed25519` | Message and grant signing/verification |
| `pg` / `drizzle-orm` | Postgres access for catalogs + grants |
| `ioredis` | Callback correlation / short-lived pub-sub (search aggregation window) |
| `@modelcontextprotocol/sdk` | MCP server implementation |
| `vitest` | TS unit/integration tests |
| `transformers`, `peft`, `trl`, `bitsandbytes` | LoRA fine-tuning pipeline (Python, RunPod) |
| `vllm` or `llama.cpp` (GGUF) | Quantized local inference of the fine-tuned model |
| `fastapi`, `uvicorn` | Serving the fine-tuned model as an internal API |
| Docker / Docker Compose | Local orchestration |
| GitHub Actions | CI: lint, test, build on every push |

---

## 8. Project Directory Structure

```
beckn-data-commons/
├── services/
│   ├── bap/                  # TS — consumer platform / orchestrator
│   ├── bpp/                  # TS — generic provider platform (config-driven, spun up 3x)
│   ├── access-manager/        # TS — consent artifact / grant issuance, revocation, expiry
│   └── mcp-server/            # TS — MCP tools wrapping the BAP + Access Manager
├── packages/
│   ├── beckn-schemas/         # shared Zod types for Beckn context/message + BDC domain + grants
│   └── crypto-utils/          # Ed25519 signing/verification helpers
├── nlu-service/                # Python — FastAPI server for the fine-tuned model
│   └── app/
├── ml/
│   ├── data-gen/               # synthetic query→schema dataset generation
│   ├── training/                # RunPod LoRA fine-tuning scripts
│   └── eval/                    # accuracy/latency/cost comparison harness
├── seed-data/                   # self-generated synthetic datasets/models served by BPPs
├── infra/
│   ├── docker-compose.yml
│   └── runpod/                  # pod launch scripts/configs
├── docs/
│   ├── domain-schema.md
│   ├── consent-artifact-spec.md
│   ├── security.md
│   └── 0X_*.md (walkthrough)
├── .github/workflows/ci.yml
├── .env.example
└── README.md
```

---

## 9. Known Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Beckn Fabric hosted testnet has occasional downtime (documented) | Keep a self-hosted registry fallback path as a stretch goal |
| Clock-skew signature failures (a documented common gotcha) | `timedatectl` check baked into setup script; short, documented signature validity window |
| Consent-artifact scope/expiry logic has subtle bugs (this is the crux of the whole project) | Dedicated test suite for grant issuance/expiry/revocation edge cases, written before Phase 4 is called done |
| Fine-tuned small model underperforms LLM function-calling | Still a valid, honest research result — the write-up covers both outcomes |
| Real dataset licensing complexity | Sidestepped entirely by using self-generated synthetic datasets/models as catalog contents |
| Scope creep (9 phases) | Each phase has an independent testable deliverable; ship after Phase 5 if time runs out, Phase 6+ clearly labeled as stretch |
| RunPod cost overrun | Fine-tuning is a short training job, not a persistent rental; spend alert set in Phase 0 |
| "Novelty" claim aging | Beckn's DDM is a fresh, unimplemented pitch as of this writing — re-check periodically, but the consent-artifact + local-NLU combination is the actual differentiator regardless |

---

## Next Step

Once you confirm this plan, we start Phase 0: full repo scaffold, Docker Compose skeleton, and Beckn Fabric sandbox registration — all in one go, per your setup rules.
