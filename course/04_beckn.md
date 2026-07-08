# 04 · The Beckn Protocol

## Learning objectives

After this module you'll be able to explain:

- What **Beckn** is and why it's a protocol for *any* transaction, not one industry.
- The **roles**: **BAP** (buyer side), **BPP** (seller side), and the **gateway/registry** that helps
  them find each other.
- The four steps of a Beckn transaction: **discover → select → init → confirm**.
- Why Beckn is **asynchronous** — the "I'll get back to you" pattern — and why that's the right design
  for an open network.
- What the **context** (with `transactionId`) is and why it matters.

## What Beckn is

**Beckn** is an open **protocol** (Module 2) for **commercial transactions** — the full arc of
discovering something, agreeing on terms, and fulfilling the deal. Crucially, it's **domain-agnostic**:
the same rules work for booking a taxi, buying groceries, purchasing electricity, or — in our case —
licensing a dataset. Beckn doesn't care *what* is being transacted; it standardizes the *conversation*
around any transaction.

That's what makes it infrastructure. Just as roads don't care whether you're driving to a wedding or a
funeral, Beckn doesn't care whether you're booking a cab or a dataset — it just provides the shared rules
for "buyer app finds seller app, they agree, the thing is delivered." ONDC (Module 3) uses Beckn for
shopping; we use it for data.

## The three roles

On a Beckn network there are three kinds of participant:

- **BAP — Beckn Application Platform.** The **buyer side**. This is the app the *consumer* uses. It takes
  the user's intent ("find me a churn dataset"), sends it out to providers, and collects the answers.
  Think of it as the buyer's agent. *(In our system, the BAP is also what an AI agent talks to.)*
- **BPP — Beckn Provider Platform.** The **seller side**. Each data/service provider runs a BPP. It holds
  a catalog, answers searches, and fulfills orders. In our network there are **three** BPPs — one for
  tabular datasets, one for image datasets, one for models — to prove it's a real *network*, not one
  seller.
- **Gateway / Registry.** The **matchmaker and phone book**. A buyer app doesn't want to know the address
  of every seller app in the world. The **gateway** broadcasts a search out to relevant providers; the
  **registry** is the directory of who's on the network and — importantly for later — *what each
  participant's cryptographic key is* (hold that thought until Module 6).

Don't let the jargon intimidate you. **BAP = buyer app. BPP = seller app.** That's it.

```
                    ┌───────────────┐
                    │  gateway +     │   phone book + broadcaster
                    │  registry      │
                    └──────┬────────┘
                           │
             ┌─────────────┼───────────────┐
     ┌───────▼──────┐      │        ┌───────▼───────┐  ┌──────────────┐
     │   BAP         │◄────┼───────►│  BPP (tabular)│  │ BPP (images) │ ...
     │ (buyer app)   │              │  (seller app) │  │              │
     └──────────────┘              └───────────────┘  └──────────────┘
```

## The transaction: discover → select → init → confirm

A Beckn deal proceeds in four named steps. Using our data example:

| Step | Plain meaning | In our data market |
| --- | --- | --- |
| **discover** | "What have you got that matches this?" | Search all providers for datasets matching "churn, ≥2000 rows" |
| **select** | "I'm interested in *that* one — draft me the terms." | Pick a specific dataset offer; get a *draft* contract |
| **init** | "Firm up the details." | Confirm the terms/parties; contract becomes active |
| **confirm** | "Done — let's do it." | Finalize; **this is where access is granted** |

Each step is a message from the buyer app to a seller app, and each has a matching reply. In Beckn the
reply's name is the step with **`on_`** in front: you send `discover`, the answer comes back as
`on_discover`; you send `confirm`, the answer is `on_confirm`. (You'll literally see `on_discover` and
`on_confirm` in Module 11.)

The thing being negotiated is called the **contract**, and it *grows* as you go: a draft after `select`,
active after `init`, and after `confirm` it carries the actual fulfillment — for us, the access to the
data. In plain Beckn, "access" at this last step would be a download URL. **Our whole project is about
replacing that URL with something better** (Modules 5–7).

## The twist: Beckn is asynchronous

Here's the part that surprises newcomers, and it matters. In Module 1 you learned the request/response
heartbeat: you ask, you get the answer back on the same connection. Beckn does **not** work that way.

When the buyer app sends `discover` to a seller app, the seller **immediately** replies with just a tiny
acknowledgement — literally `ACK`, meaning "got it, I'll get back to you." The *real* answer (the
catalog) arrives **later**, as a **separate** message the seller sends *back to the buyer app* at the
buyer's own address.

```
BAP ── discover ─────────────▶ BPP
BAP ◀── "ACK" (got it!) ──────  BPP          (instant, but NOT the answer)

        ... moments later, as a brand-new message ...

BPP ── on_discover (here's the catalog!) ──▶ BAP     (the real answer, sent separately)
```

**Why design it this weird way?** Because on an open network a single search might fan out to *many*
providers, and some might be slow, busy, or need a human in the loop to approve something. If the buyer
had to hold one connection open waiting for the slowest provider, everything would jam. Instead: everyone
says "ACK, I'll call you back," and the buyer collects the callbacks as they arrive. It's the difference
between standing frozen at a counter until your food is ready, versus taking a buzzer and being called
when *any* order is done.

This has a real consequence for the buyer app, and you'll see it directly in the code (Module 7): the BAP
must **fan a search out to all providers, then gather the `on_*` replies that trickle back, and stop
waiting after a short window.** Providers that don't answer in time simply don't contribute — the search
still returns what it got.

## The context — how replies find their way home

If answers come back as *separate* messages, how does the buyer app know which reply belongs to which
request? Every Beckn message carries a **context** — a little header block of bookkeeping. The key field
is the **`transactionId`**: a unique id that stays the same across the *entire* discover→confirm journey.
When three providers each call back separately, the buyer app reads the `transactionId` on each callback
and knows "these all belong to *that* user's search." (There's also a `messageId` for matching a single
request to its single reply.)

A real context from our system looks like this — don't memorize it, just see that it's plain JSON
bookkeeping:

```json
{
  "networkId": "nfh.global/testnet-ddm",
  "action": "on_discover",
  "version": "2.0.0",
  "bapId": "bap.example.com",
  "bppId": "bpp.example.com",
  "transactionId": "550e8400-e29b-41d4-a716-446655440100",
  "messageId": "550e8400-e29b-41d4-a716-446655440102",
  "timestamp": "2025-02-15T10:00:01Z",
  "ttl": "PT30S"
}
```

(`ttl` = "time to live," how long this message is valid — 30 seconds here. Tuck that away; it becomes
part of our security story in Module 6.)

## A note for the curious: we verified this against the real thing

A recurring rule in this project is *"don't trust the spec document — check what the wire actually
carries."* When the team ran a real Beckn v2 sandbox, they found the real messages differed from the
older documentation (for instance, fields are written `transactionId`, not `transaction_id`, and the
search action is `discover`, not the older `search`). Building against assumptions would have broken the
code. The verified findings are written up in [`docs/00_protocol.md`](../docs/00_protocol.md). The lesson
generalizes: with real external systems, *inspect first, then build.*

## Why this beats the alternative

Why put a data market on Beckn instead of just building a data website with a search box? Because a
website is a **platform** (Module 2): its sellers are trapped in its catalog, its buyers can only use its
front-end, and one company owns the middle. Putting the market on **Beckn** makes it an **open network**:
any buyer app (including an AI agent's) can discover from any provider, providers aren't locked to one
storefront, and new participants join just by speaking the protocol. Same reason UPI beat the wallet
apps — the value moves to the open rails.

## Where this lives in the project

- The buyer app is `services/bap/`; the seller apps are three instances of `services/bpp/`. Walkthroughs:
  [`docs/02_bap.md`](../docs/02_bap.md) and [`docs/03_bpp.md`](../docs/03_bpp.md).
- The verified protocol facts (async ACK+callback, the context, discover→confirm) are in
  [`docs/00_protocol.md`](../docs/00_protocol.md).
- The "collect the callbacks in a time window" behavior is the BAP's job — Module 7 shows how.

## Check your understanding

1. Translate to plain English: BAP, BPP, gateway.
2. What are the four steps of a Beckn transaction, and which one grants access?
3. Beckn is asynchronous. What does the seller send back *immediately*, and how does the real answer
   arrive?
4. Three providers reply to one search as three separate messages. How does the buyer app know they all
   belong to the same original request?

<details>
<summary>Answers</summary>

1. **BAP** = the buyer's app. **BPP** = a seller/provider's app. **Gateway/registry** = the matchmaker
   (broadcasts searches) and phone book (directory of participants and their keys).
2. **discover → select → init → confirm.** **confirm** is where access is granted (in plain Beckn, as a
   download URL; in our system, as an Access Grant).
3. Immediately it sends a tiny **`ACK`** ("got it, I'll get back to you"). The real answer arrives *later*
   as a **separate** message (`on_discover`) sent to the buyer app's own address.
4. Every message carries a **context** with a **`transactionId`** that's constant across the whole
   journey; the buyer app matches callbacks by that id.

</details>

## Key terms

**Beckn**, **BAP**, **BPP**, **gateway**, **registry**, **discover/select/init/confirm**,
**asynchronous**, **ACK**, **callback (`on_*`)**, **context**, **transactionId**, **ttl**, **contract**.
See the [Glossary](./GLOSSARY.md).

Next: **[05 · Data & Consent](./05_data_and_consent.md)** — why data needs more than a download link.
