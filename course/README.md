# Beckn Data Commons — A Course From Scratch

Welcome. This is a **course**, not a reference manual. It is written for someone who is *brand new* —
you don't need to know what a protocol is, what "the cloud" means, what a public key does, or what
Beckn, DPI, or MCP stand for. We start from zero and build up, one idea at a time, until you can explain
the whole system to a friend and then run it yourself and watch it work.

The system we're studying, **Beckn Data Commons (BDC)**, is a small but real piece of software: an open
network where AI agents can *find*, *license*, and *download* machine-learning datasets — but only after
receiving a **signed, revocable permission slip** instead of a naked download link. If none of those
words mean anything yet, good. That's the point of the course.

## What you'll be able to do at the end

- Explain **why the internet's "platform" model concentrates power**, and how **open protocols** and
  **Digital Public Infrastructure (DPI)** change that — with UPI (India's payments network) as the
  killer example.
- Describe **Beckn**, the open protocol for online transactions, and how a "buyer app" and a "seller
  app" talk without either owning the other.
- Explain **why sharing data is a harder problem than selling shoes**, and what **consent as
  infrastructure** (the DEPA idea) means.
- Understand **just enough cryptography** — hashing, signatures, keys — to see how a permission slip can
  be *unforgeable*, *time-limited*, and *revocable*.
- Understand what an **AI agent** is and how **MCP** lets one drive this whole network in plain English.
- **Boot the real system on your own computer** and watch an agent search, get a grant, download data,
  then have that access revoked in real time.

## Prerequisites

**None.** If you can open a web browser and copy-paste a command, you can do this course. Everything
else — the terminal, servers, APIs, JSON, containers, cryptography — is explained here from scratch. The
only thing you'll install (and only for the final hands-on module) is Docker, and we walk you through it.

## How the course is organized

Read the modules in order — each one leans on the last.

| # | Module | What it gives you |
| --- | --- | --- |
| 00 | [Orientation](./00_orientation.md) | The problem in one story, and the map of where we're going |
| 01 | [Foundations](./01_foundations.md) | Programs, servers, the terminal, the internet, APIs, JSON |
| 02 | [Platforms vs. Protocols](./02_platforms_vs_protocols.md) | Why walled gardens win today, and the alternative |
| 03 | [Digital Public Infrastructure](./03_dpi.md) | DPI, the India Stack, UPI, ONDC — shared public rails |
| 04 | [The Beckn Protocol](./04_beckn.md) | The open protocol for transactions; how buyer & seller apps talk |
| 05 | [Data & Consent](./05_data_and_consent.md) | Why data is special; the download-link problem; DEPA & consent |
| 06 | [Just Enough Cryptography](./06_cryptography.md) | Hashing, keys, signatures — how a permission slip becomes unforgeable |
| 07 | [Our System: Beckn Data Commons](./07_our_system.md) | The Access Grant and how every idea so far fits together |
| 08 | [The Infrastructure](./08_infrastructure.md) | Services, Docker, databases — how it actually runs |
| 09 | [MCP & AI Agents](./09_mcp_and_agents.md) | Agents, tools, and driving the network in natural language |
| 10 | [Why This Is Better](./10_why_better.md) | The whole argument, side by side with the alternatives |
| 11 | [Capstone: Run It Yourself](./11_capstone.md) | Boot the network and watch the whole story happen live |
|  | [Glossary](./GLOSSARY.md) | Every term, defined in one place |

## How to read each module

Every concept module has the same shape, so you always know where you are:

1. **Learning objectives** — what you'll be able to explain afterward.
2. **The explanation** — plain language, an everyday analogy first, jargon second.
3. **Why this beats the alternative** — the question we keep asking, because it's the whole point.
4. **Where this lives in the project** — a pointer to the real code/docs, so theory connects to a
   thing you can actually open.
5. **Check your understanding** — a few questions (answers at the bottom).
6. **Key terms** — collected in the [Glossary](./GLOSSARY.md).

Don't rush. If a module's "why is this better" section clicks, you've got the important part.

## A note on honesty

This course describes a **portfolio/research project**, not a production service. Where the system takes
a shortcut or leaves something for later (it does — see [Module 10](./10_why_better.md)), we say so
plainly. Learning *what isn't done yet and why* is part of understanding it.

Ready? Start with **[00 · Orientation](./00_orientation.md)**.
