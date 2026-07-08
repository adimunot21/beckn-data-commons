# 08 · The Infrastructure — how it actually runs

## Learning objectives

After this module you'll be able to explain:

- What a **microservice** architecture is and why this system is split into several small services.
- What **Docker** and **containers** are, and the problem they solve ("works on my machine").
- What **Docker Compose** does — booting the whole network with one command.
- Why there's a **database** (Postgres) and what the **revocation list** is stored in.
- What a **monorepo**, **TypeScript**, and **schemas (Zod)** are, and why the project uses them.
- Why the project is **tested**, and the neat trick that makes testing an open network easy.

This module is the "how is it actually built and run" tour, still assuming zero background. You don't
need to write any code — but you'll understand what you're booting in Module 11.

## Small services instead of one big program

We could have built Beckn Data Commons as one giant program. Instead it's several **small, independent
services** (Module 1: a service is a program that starts and waits), each doing one job:

| Service | Its one job | Door (port) |
| --- | --- | --- |
| **BAP** | The buyer app — orchestrates searches and transactions | 3001 |
| **BPP** ×3 | Seller apps — one per catalog (tabular / image / models) | 3002 / 3012 / 3022 |
| **Access Manager** | Issue/record/revoke grants | 3003 |
| **Postgres** | The database (stores grants, the revoked list) | 5432 |
| **Redis** | A fast scratchpad store (available for short-lived data) | 6379 |

This style is called **microservices**: many small services that each do one thing and talk over the
network (Module 1's request/response). Why bother, instead of one big program?

- **It mirrors reality.** On a *real* Beckn network the buyer app, the seller apps, and the consent
  authority are run by *different organizations* on *different computers*. Splitting them into separate
  services makes our local version an honest miniature of that — the BAP genuinely talks to the BPPs over
  HTTP, exactly as it would across the internet.
- **Independence.** Each can be built, tested, and reasoned about on its own.
- **It proves the point.** Three *separate* BPPs answering one search is the difference between "a
  network" and "a website with three folders."

## The "works on my machine" problem, and Docker

Here's a problem every developer hits. A service needs a specific version of a language, specific
libraries, specific settings. It runs fine on the author's laptop — then breaks on yours because your
versions differ. Multiply by seven services and you have a nightmare of setup instructions.

**Docker** solves this with **containers**. A **container** is a lightweight, self-contained box that
packages a service *together with everything it needs to run* — the right language version, libraries,
and settings — so it runs *identically* on any computer that has Docker. 

The classic analogy is **shipping containers**. Before them, cargo was loaded loose, and every ship,
truck, and crane handled it differently. The standardized steel container meant *anything* inside it
could be moved by *any* ship or crane without repacking. A software container does the same for programs:
whatever's inside, the outside is standard, so any machine with Docker can run it without "repacking."

So each of our services runs inside its own container. You don't install their languages or libraries on
your laptop — Docker carries all of that inside the box. Your only install is Docker itself.

## Docker Compose — the whole network, one command

Seven containers that need to start in the right order and know each other's addresses is a lot to launch
by hand. **Docker Compose** is a tool that reads one file describing all the containers — and starts the
entire network with a single command.

That file (`infra/docker-compose.yml`) is essentially the *wiring diagram* of the whole system: it lists
each service, which door (port) it listens on, which other services it depends on, and its settings (like
which catalog a BPP serves, or the keys it uses). In Module 11 you'll run literally one command —
`docker compose up` — and watch all seven come to life and report themselves healthy. That one file is
why the whole open network fits on your laptop.

## The database, and the revoked list

Some information must **survive restarts** — you can't keep it only in a program's memory, because
memory vanishes when the program stops. That's what a **database** is for: durable, structured storage.
This project uses **Postgres**, a very common, reliable database.

The most important thing in it, for our story, is the **revocation list**: a table recording which
`grantId`s have been revoked. Remember the online check from Modules 6–7 — when you download, the BPP asks
"is this grant's id on the revoked list?" *That list is a table in Postgres.* The Access Manager
**writes** to it (when you revoke); every BPP **reads** from it (on every download). It's a *shared* table
precisely so that revoking once, at the authority, is honored by every data holder. (There's also
**Redis**, a fast in-memory store, available for short-lived data; you can ignore it for understanding
the core story.)

## The building blocks: monorepo, TypeScript, schemas

A few more terms you'll see, explained plainly:

- **Monorepo** — "mono" (one) + "repo" (a project's folder of code). All the services and shared code
  live in *one* repository, so they can share common pieces and be worked on together. The two shared
  pieces here are `crypto-utils` (the signing/hashing helpers from Module 6) and `beckn-schemas` (the
  message and grant definitions).
- **TypeScript** — the programming language the services are written in. It's JavaScript (the language
  of the web) plus **types**: labels that say "this value must be a number," "this must be text." Types
  catch a huge class of mistakes *before* the program ever runs — like spell-check for code.
- **Schemas (Zod)** — a **schema** is a precise description of what a valid message looks like ("must
  have a `grantee` which is an object with an `id` that's text…"). The project uses a tool called **Zod**
  to define schemas and **validate** incoming messages against them at the door. This matters for an open
  network: messages arrive from other parties, and you must *never* trust their shape blindly. The schema
  is the bouncer that rejects malformed input before it can cause harm. (It's the same "inspect, don't
  assume" discipline from Module 4.)

## Why it's tested — and a clever trick

The project has **117 automated tests** — small programs that check the real code does what it should
(signatures verify, expired grants are rejected, revoked downloads return 403, and so on). Tests are how
you *know* the security claims actually hold, rather than hoping.

But testing an *asynchronous open network* (Module 4's ACK-then-callback dance) sounds hard — do you need
to boot all seven services and a database for every test? No, and the trick is worth knowing because it's
good engineering:

> The services are built so their moving parts — the database, the network transport, the clock, the
> signing keys — are **handed in from outside** rather than hard-wired.

That means a test can hand a service a *fake* database (just in memory), a *fake* network that instantly
delivers callbacks, and a *fixed* clock — and exercise the real logic deterministically, with no Docker
and no real network. This is called **dependency injection**, and it's why the whole message flow can be
tested in milliseconds. (The same seams let the real program use the *real* Postgres and *real* network in
production.)

## Why this beats the alternative

Could you understand Beckn Data Commons without Docker, Postgres, or types? Sort of — but the *point* is
that it's a faithful, runnable miniature of a real multi-organization network, and that only works if the
independent parties are genuinely separate services that a stranger can boot reliably on any machine.
Containers make "runs identically everywhere" true; Compose makes "the whole network, one command" true;
the shared database makes "revoke once, honored everywhere" true; types and schemas make "don't trust
input from the open network" enforceable; tests make the security claims *checkable*. The infrastructure
choices all serve the same goal as the rest of the project: a real, trustworthy, open network — not a
demo that only works in one person's hands.

## Where this lives in the project

- The wiring diagram: [`infra/docker-compose.yml`](../infra/docker-compose.yml).
- The shared code: `packages/crypto-utils/` (Module 6 primitives) and `packages/beckn-schemas/` (message
  + grant schemas).
- The infrastructure-minded parts of the service walkthroughs: [`docs/02_bap.md`](../docs/02_bap.md),
  [`docs/03_bpp.md`](../docs/03_bpp.md).

## Check your understanding

1. Why is the system built as several separate services rather than one program — and what does having
   *three separate* BPPs prove?
2. What problem do Docker containers solve? Use the shipping-container analogy.
3. Where is the "revoked list" stored, who writes to it, who reads it, and why must it be *shared*?
4. What is a schema (Zod), and why does an *open* network especially need to validate incoming messages?

<details>
<summary>Answers</summary>

1. Because a real Beckn network is many organizations on different computers; separate services make our
   local version an honest miniature (the BAP really talks to BPPs over HTTP), and each part stays
   independent. Three separate BPPs prove it's a *network*, not one seller with three folders.
2. The "works on my machine" problem — services need specific versions/libraries/settings. A container
   packages a service *with everything it needs*, so it runs identically anywhere Docker is installed —
   like a standardized shipping container that any ship or crane can move without repacking.
3. In the **Postgres** database, as a table. The **Access Manager writes** to it (on revoke); **every
   BPP reads** it (on each download). It's shared so that revoking once at the authority is honored by
   every data holder.
4. A schema is a precise description of a valid message; Zod validates incoming messages against it. An
   open network receives messages from untrusted third parties, so their shape must be checked at the
   door — never trusted blindly.

</details>

## Key terms

**Microservice**, **Docker**, **container**, **Docker Compose**, **database**, **Postgres**, **Redis**,
**revocation list/table**, **monorepo**, **TypeScript**, **types**, **schema / Zod**, **test**,
**dependency injection**. See the [Glossary](./GLOSSARY.md).

Next: **[09 · MCP & AI Agents](./09_mcp_and_agents.md)** — how an AI drives all of this in plain English.
