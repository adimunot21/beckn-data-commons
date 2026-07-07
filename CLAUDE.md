# CLAUDE.md — Beckn Data Commons

This file is your operating manual for this repo. Read `PROJECT_PLAN.md` first for the full architecture, phase breakdown, and rationale — this file is about *how we work*, not *what we're building*.

## What this project is

A Beckn Protocol network for discovering and licensing ML datasets/models, where access is gated by a signed, scoped, revocable "Access Grant" (a DEPA-inspired consent artifact) instead of a raw download link — wrapped in an MCP server so any LLM agent can transact on it in natural language, with a locally fine-tuned model (trained on RunPod) doing intent parsing. Full detail in `PROJECT_PLAN.md`.

## About the developer

- Knows Python, git, terminal well. Can follow TypeScript/Node instructions but isn't an expert in it — give clear, complete steps, don't assume familiarity.
- Hardware: Lenovo Legion Y540, 6-core i7-9750H, 32GB RAM, GTX 1650 (4GB VRAM, CUDA 13.0, driver 580.126.09), Ubuntu 24.04.4 LTS.
- Local GPU is for quantized inference only (fine-tuned NLU model post-training) — LoRA training happens on a rented RunPod GPU, not locally.
- Environment already set up: zsh/Oh My Zsh, git+SSH (github.com/adimunot21), Miniforge (conda, base auto-activation off), Docker (docker-ce), VS Code, ffmpeg, standard CLI tools.
- **GitHub repos must be created on github.com first** before any `git remote add origin` / push — always remind before the first push of a new repo.

## How we work

**This is not a tutorial.** Ship working code efficiently. Explain decisions briefly when they affect what the developer needs to do or type; don't teach the theory behind routine code.

**Phase discipline.** `PROJECT_PLAN.md` Section 6 defines Phases 0–9. Work one phase at a time. Each phase has an explicit deliverable — don't move to the next phase until the current one's deliverable is actually verified working (health check passes, test passes, manual flow completes). If the developer gets stuck on a task and you help them fix it, check whether the other tasks you gave in that same step are actually done before moving on — don't assume they are.

**Complete code, always.** No placeholders, no `// TODO`, no "implement this yourself." If a file needs 300 lines, write 300 lines.

**Setup in one shot.** For Phase 0 and any environment/dependency step: give directory structure (`mkdir -p` + `tree`), environment setup (conda/npm/pnpm, pinned versions), `.gitignore`, config files, git init, and a sanity-check command — all together, not drip-fed.

**Terminal commands, always exact.** Copy-paste ready, every time — for installs, running, testing, building, deploying.

**Test immediately, in small steps.** Don't hand over 5 files with no way to verify until they're all wired up. Build up incrementally: something runnable and checkable after each step.

**File handoff.** Never tell the developer to download an artifact and move it into a folder. Either give a `cat > path << 'EOF' ... EOF` block, or tell them to paste the file content into VS Code at an exact path.

**Commit discipline.** After every working milestone: tell the developer to commit and push, with the exact commands and a real commit message (not "wip").

**External protocol data — mandatory, not optional.** Before writing any code that parses a Beckn Fabric / sandbox / registry response: fetch a real sample first (Postman or a throwaway script) and print the actual field names, types, and shape. Never assume Beckn message fields match the spec doc exactly — verify against a real response before building the parser. This applies to every new external integration in this project (Fabric registry, RunPod API, HuggingFace-style catalog formats if referenced) — same rule as the developer's standing "no assuming data semantics" policy.

**Debugging.** Read the actual error, diagnose from it, don't guess. Minimal fix for a small bug — don't rewrite a whole file for a one-line issue. If the underlying approach is wrong, say so plainly and pivot rather than patching around it.

**Communication style.** Direct, concise. State a recommendation with one sentence of justification, not a comparison essay. Don't ask permission at every step — keep momentum, hand over the next concrete thing to do. If a step will take a long time (e.g. LoRA training run, RunPod pod boot), warn with a time estimate upfront. If the developer pastes a large error log or docker-compose log dump, pull out the relevant lines and explain them — don't ask them to re-paste.

**Security is not optional in this project.** Signature verification, grant expiry/revocation checks, and replay protection are core to what this project is *demonstrating* — never leave a "skip verification in dev mode" flag on past Phase 3, and call it out explicitly if you ever add one temporarily for local iteration.

**Docs, at the end.** Once the project is shipped (post Phase 8), write the `docs/` code walkthrough per `PROJECT_PLAN.md` Phase 9 — practical "here's what we built and why" reference, not a tutorial. Then link it from the README.

## Current status

Start at **Phase 0** in `PROJECT_PLAN.md`. Nothing has been built yet.
