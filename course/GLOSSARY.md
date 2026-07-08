# Glossary

Every term the course introduces, in one place, in plain language. The module where each is explained is
in brackets. Read the modules for the full story; use this to jog your memory.

## Foundations

- **Program** — a set of instructions a computer runs, with a beginning and end. [01]
- **Service / Server** — a program that starts up and *waits*, answering requests from other programs
  (like a restaurant kitchen taking orders). [01]
- **Client** — the program that *asks* (sends a request). A role, not a brand. [01]
- **localhost** — the name a computer uses for *itself*; where our services find each other when run on
  one machine. [01]
- **Port** — a numbered "door" on a machine so many services can run at once; e.g. `localhost:3002`. [01]
- **HTTP** — the common set of rules (a protocol) for messages on the web. [01]
- **GET / POST** — "give me something" / "here's data, do something with it." [01]
- **Status code** — a 3-digit result on a response: **200** OK, **401** unauthenticated (who are you?),
  **403** forbidden (you're not allowed), **404** not found. [01]
- **API** (Application Programming Interface) — the fixed menu of requests a service offers to *other
  programs* (usually exchanging JSON). Not the same as a protocol. [01]
- **JSON** — a text format for data: objects `{ }` (labelled bundles), lists `[ ]`, and values. [01]
- **Request / Response** — the heartbeat of everything: a client asks, a server answers. [01]

## Platforms, protocols, DPI

- **Platform** — a private company's system buyers and sellers must join; tends toward a walled garden
  that owns the middle. [02]
- **Walled garden** — a platform where relationships and data are locked inside, so users/sellers can't
  easily leave or interoperate. [02]
- **Protocol** — a shared, open set of rules that lets independent parties interoperate with *no single
  owner* (e.g. HTTP, email). [02]
- **Interoperability** — the property that any compliant participant can work with any other. [02]
- **Open network** — a network defined by an open protocol, which any compliant app/agent can join. [02]
- **Lock-in** — being stuck on a platform because leaving means losing your relationships/data. [02]
- **Infrastructure** — shared, essential foundations everything builds on (roads, power). [03]
- **Public (infrastructure)** — open to all on equal terms, not owned by one company for advantage. [03]
- **DPI (Digital Public Infrastructure)** — shared digital rails (identity, payments, data, commerce)
  built as open protocols. [03]
- **India Stack** — India's set of DPI rails; the leading real-world example. [03]
- **UPI** — India's open instant-payments protocol; any app can pay any bank account; *the* DPI example
  of an open protocol beating walled-garden apps. [03]
- **Aadhaar** — India Stack's digital identity rail. [03]
- **DigiLocker** — India Stack's rail for holding/sharing official documents. [03]
- **Unbundling** — splitting a platform's bundled capabilities (identity, payments, discovery, consent)
  into separate open rails anyone can plug into. [03]
- **ONDC** (Open Network for Digital Commerce) — an open network for e-commerce built on Beckn; the direct
  inspiration for this project. [03]

## Beckn

- **Beckn** — an open, domain-agnostic protocol for commercial transactions (discover → confirm). [04]
- **BAP** (Beckn Application Platform) — the **buyer app**; takes the user's/agent's intent, fans searches
  out, drives the transaction. [04]
- **BPP** (Beckn Provider Platform) — a **seller/provider app**; holds a catalog and fulfills orders.
  Also the **data holder** that serves data only against a valid grant. [04]
- **Gateway** — broadcasts a buyer's search out to relevant providers. [04]
- **Registry** — the network's directory of participants and their public keys (the "phone book of
  keys"). [04]
- **discover / select / init / confirm** — the four steps of a Beckn transaction; **confirm** is where
  access is granted. [04]
- **Asynchronous** — the reply doesn't come back on the same connection; the provider sends it *later* as
  a separate message. [04]
- **ACK** — the instant "got it, I'll get back to you" a provider returns before the real answer. [04]
- **Callback (`on_*`)** — the real answer, sent separately (`on_discover`, `on_confirm`, …). [04]
- **Context** — bookkeeping header on every Beckn message. [04]
- **transactionId** — id constant across a whole discover→confirm journey; how a buyer app matches
  callbacks to the request that started them. [04]
- **ttl** (time to live) — how long a message is valid; basis for replay protection. [04, 06]
- **Contract** — the object being negotiated across select/init/confirm; grows as it progresses. [04]

## Data & consent

- **Download-link problem** — access as a URL is invisible (unaccountable), non-revocable, and unscoped —
  inadequate for data. [05]
- **DDM** — the official Beckn data-marketplace extension; its access model is exactly a bearer download
  URL, which this project improves on. [05]
- **Consent as infrastructure** — treating permission as its own first-class, recorded, revocable object
  on its own rail. [05]
- **DEPA** (Data Empowerment and Protection Architecture) — the pattern (from India's regulated data
  sharing) of separating the **data holder** from the **consent manager**, with a **consent artifact** as
  the permission slip. Borrowed here as an *architectural pattern*, not a regulated implementation. [05]
- **Data holder** — the party that holds the data and serves it only against valid permission (our
  **BPP**). [05]
- **Consent manager** — the independent authority that issues/records/revokes permission but holds no
  data (our **Access Manager**). [05]
- **Data consumer / Grantee** — the party granted access (our user, or their agent). [05]
- **Consent artifact** — the structured, signed permission record (our **Access Grant**). [05]
- **Scope** — how much access: `full`, `sample`, or `subset` (specific fields). [05, 07]
- **Purpose** — the stated reason access was granted, recorded in the grant. [05, 07]
- **License class** — the terms access is issued under (e.g. permissive, research-only). [07]
- **Revocable** — able to be withdrawn after issue. [05]

## Cryptography

- **Hash** — a short "fingerprint" of any data; same input → same hash, any change → totally different
  hash, and not reversible. [06]
- **Key pair** — a matched **private key** (kept secret) and **public key** (shared). [06]
- **Private key / Public key** — something done with the private key can be *checked* by anyone with the
  matching public key, but not *done* by them. [06]
- **Digital signature** — a stamp made with a private key that proves *who* authored a message and that it
  *wasn't altered*; verifiable by anyone with the public key. (A wax seal only your ring can make.) [06]
- **Ed25519** — the specific modern, fast digital-signature scheme used here. [06]
- **Canonical JSON** — a single agreed way to write JSON (sorted keys, no extra spaces) so signer and
  verifier compute identical bytes and signatures match. [06]
- **Offline check** — verifying a grant from its own signed contents + the issuer's public key, no
  network: signature, time window, provider/resource/scope. [06, 07]
- **Online check** — a lookup at download time against the shared revoked list — the only way to catch
  **revocation**. [06, 07]
- **Revocation** — withdrawing a grant after issue; enforced via the online check. [06, 07]
- **Replay attack** — copying a genuine signed message and sending it again to make something happen
  twice. [06]
- **Nonce** — a random "use-once" value in a message; a repeat is detected as a replay. [06]

## Our system

- **Beckn Data Commons (BDC)** — this project: an open Beckn network for licensing ML datasets/models,
  where access is gated by a signed, scoped, revocable Access Grant instead of a download link, drivable
  by an AI agent via MCP. [07]
- **Access Grant** — the star: a **consent artifact** with `claims` (grantee, resource, scope, purpose,
  expiry, revocable, …) plus an **Ed25519 signature** over the canonical claims. [07]
- **Access Manager** — the independent consent authority (separate service, separate signing key) that
  issues, records, and revokes grants. [07]
- **grantId** — a grant's unique id; also the key used to revoke it and to check the revoked list. [07]
- **"Every hop is signed"** — messages between the BAP, BPPs, and Access Manager are each signed and
  verified, so no impostor can forge or replay them. [06, 07]

## Infrastructure

- **Microservice** — one of several small, independent services that each do one job and talk over the
  network. [08]
- **Docker** — a tool that runs software in **containers**. [08]
- **Container** — a self-contained box packaging a service with everything it needs, so it runs
  identically on any machine (like a standardized shipping container). [08]
- **Docker Compose** — starts a whole network of containers from one description file, with one command.
  [08]
- **Database** — durable, structured storage that survives restarts. [08]
- **Postgres** — the database this project uses; holds grants and the revoked list. [08]
- **Redis** — a fast in-memory store, available for short-lived data. [08]
- **Revocation list / table** — the shared record of revoked grants; the Access Manager writes it, every
  BPP reads it. [08]
- **Monorepo** — one repository holding all services and shared code together. [08]
- **TypeScript** — the language the services are written in; JavaScript plus **types**. [08]
- **Types** — labels that constrain what a value can be, catching mistakes before running (spell-check for
  code). [08]
- **Schema / Zod** — a precise description of a valid message; **Zod** validates incoming messages against
  it at the door. [08]
- **Test** — a small program that automatically checks the real code behaves correctly. [08]
- **Dependency injection** — handing a service its moving parts (database, network, clock, keys) from
  outside, so tests can supply fakes and exercise real logic instantly. [08]

## MCP & agents

- **LLM** (Large Language Model) — the kind of AI behind chat assistants; on its own it only produces
  text. [09]
- **AI agent** — an LLM given the ability to *act* (use tools), not just talk. [09]
- **Tool use / Function calling** — giving a model a menu of actions it can call, running them, and
  feeding results back; the model supplies judgment, the tools supply actions. [09]
- **MCP** (Model Context Protocol) — an open protocol for connecting AI models to tools and data —
  "USB-C for AI tools." [09]
- **MCP server / tool** — a program exposing capabilities as MCP tools any MCP-speaking agent can use;
  ours exposes the seven BDC tools. [09]
- **NLU** (Natural Language Understanding) — here, a planned (not-yet-built) small model to translate
  requests into the network's search format. [09, 10]

## The argument

- **Bearer token** — a credential usable by whoever *holds* it (no proof of identity required); a current
  limitation of the grants. [10]
- **Proof-of-possession** — a designed fix: require the grantee to prove they hold the matching key, so a
  leaked grant is useless to others. [10]
- **Third-party verifiability** — anyone (not just the issuer) can validate the grant, using the public
  key; a property download links and tokens lack. [10]

Back to the [course start](./README.md).
