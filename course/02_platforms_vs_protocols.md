# 02 · Platforms vs. Protocols

## Learning objectives

After this module you'll be able to explain:

- What a **platform** is, and why platforms tend to become **walled gardens** that concentrate power.
- What a **protocol** is, using two you already use every day (the web and email).
- The crucial difference between a **platform**, a **protocol**, and an **API**.
- Why "**protocol, not platform**" changes *who holds the power* in a market — the idea the rest of the
  course rests on.

## Start with a question

When you order food online, you probably open one app — say, a big delivery platform. That app shows you
restaurants, takes your order, handles payment, and arranges delivery. Convenient. But notice what
happened: **one company sits between every buyer and every seller.** The restaurant can't reach you
except through that company. You can't reach the restaurant except through that company. Whoever owns
the middle owns the market.

That company is a **platform**. Understanding why platforms behave the way they do — and what the
alternative is — is the foundation of everything in this course.

## What a platform is

A **platform** is a private company's system that both buyers and sellers must join to find each other.
The platform owns the "meeting place." Think Uber, Amazon, a food-delivery app, an app store.

Platforms are genuinely useful — they solved a real problem (discovery and trust between strangers). But
they have a built-in gravity toward becoming a **walled garden**:

- **They own the relationship.** The seller is *the platform's* seller; the customer is *the platform's*
  customer. Neither can easily leave, because the connection only exists inside the walls.
- **They set the tolls.** Once everyone's inside, the platform can raise commissions, reorder search
  results to favor whoever pays, or change the rules overnight. Sellers have no alternative, because
  that's where the buyers are.
- **They don't interoperate — on purpose.** Your ride on one app can't be booked from a competitor's
  app. The lock-in *is* the business model.
- **Small players can't compete.** To start a rival, you'd have to attract *both* buyers and sellers at
  once (the "chicken-and-egg" problem). Almost no one can, so the incumbent stays dominant.

This isn't villainy; it's the natural physics of a privately-owned meeting place. The question is
whether there's a different shape entirely.

## What a protocol is

There is, and you already rely on it. A **protocol** is a **shared, open set of rules** that lets
independent parties talk *without any of them owning the meeting place*. Two everyday examples:

- **The web (HTTP).** Nobody owns "the web." Anyone can run a website; any browser can visit any
  website. Chrome, Safari, and Firefox are different companies' browsers, yet they all reach the same
  sites, because they all follow the same **protocol** (HTTP, from Module 1). Google doesn't get to
  block your site from Firefox.
- **Email (SMTP).** You have Gmail, your friend has an Outlook address, your bank uses its own mail
  server — and mail flows between all of them. No one signs up for "the email platform," because email
  is a **protocol**, not a platform. Any provider that speaks the rules can join, and they all reach
  each other.

That's the magic word: **interoperability**. Under a protocol, a message from *any* compliant sender
reaches *any* compliant receiver. The meeting place is the *rules*, which are public, not a company,
which is private.

### A picture

```
  PLATFORM (walled garden)              PROTOCOL (open network)

   buyers                                buyer apps        seller apps
     \                                     A   B   C         X   Y   Z
      \                                     \  |  /           \  |  /
   ┌────▼─────┐                              \ | /   shared    \ | /
   │ ONE       │                              \|/    rules      \|/
   │ COMPANY   │  ← owns the middle      ──────●────────────────●──────
   │ (the wall)│                          any buyer app can reach any
   └────▲─────┘                           seller app that speaks the rules
      /                                    (no single owner in the middle)
   sellers
```

## Platform vs. protocol vs. API — don't confuse these

These three words get muddled constantly. Keep them straight:

| Term | What it is | Who controls it | Analogy |
| --- | --- | --- | --- |
| **Platform** | A company's system buyers & sellers must join | The company | A private shopping mall |
| **Protocol** | Public rules anyone can implement to interoperate | No one (it's a spec) | The rules of the road / a shared language |
| **API** | *One* service's menu of requests (Module 1) | Whoever runs that service | One shop's order form |

The subtle trap: **an API is not the same as a protocol.** A platform can have a big, well-documented
API and still be a walled garden — because that API is *theirs*, it works only with *their* system, and
they can change or revoke your access. A protocol is different in kind: it's an agreement *many
independent parties* implement, so no single one of them can lock the others out. (Beckn, in Module 4,
is a protocol. The services we build each expose an API. Both are true at once, and that's fine.)

## "Protocol, not platform" — why it changes the power structure

Here's the payoff, and it's the thesis under this whole project.

When a market runs on a **platform**, power flows to the owner of the middle. When the same market runs
on a **protocol**, the middle disappears — there are just many buyer apps and many seller apps following
public rules, free to connect in any combination. That flips the incentives:

- **Sellers aren't trapped.** They're reachable from *any* buyer app, so no single gatekeeper can tax
  them at will.
- **New apps can enter.** A newcomer only has to speak the protocol; it instantly reaches every
  participant already on the network. No chicken-and-egg.
- **Competition is on merit.** Apps compete on being *good*, not on being *the only door*.
- **Users can switch.** Because your relationships live on the open network, not inside one app, moving
  to a better app doesn't mean starting over.

This is not a hypothetical. The next module tells the story of how an entire country moved payments from
walled-garden apps onto an open protocol — and what happened.

## Why this beats the alternative

A platform optimizes for *the platform*. A protocol optimizes for *the participants*. If your goal is an
open, competitive market where power doesn't pool in one company — and especially if you want *anyone's*
software (including an AI agent) to be able to join without asking permission — you want a **protocol**.
That's the design choice at the root of Beckn Data Commons: the data market is an **open network**, not
one more data-broker website.

## Where this lives in the project

The whole system is a set of independent services that any compliant app could, in principle, talk to —
because they speak an open protocol (Beckn) rather than exposing a proprietary platform API. You'll meet
the specific roles ("buyer app" = **BAP**, "seller app" = **BPP**) in Module 4, and see them running as
separate services in [`docs/01_architecture.md`](../docs/01_architecture.md).

## Check your understanding

1. Give one example each of a protocol you use every day, and explain why it's a protocol and not a
   platform.
2. A company offers a huge, free, well-documented API. Does that make it an open protocol? Why or why
   not?
3. In the protocol world, why can a brand-new app reach every participant immediately, avoiding the
   "chicken-and-egg" problem that kills most platform competitors?

<details>
<summary>Answers</summary>

1. Email (SMTP) or the web (HTTP). It's a protocol because it's a *public set of rules* that many
   independent providers implement, so any compliant sender reaches any compliant receiver — no single
   company owns the meeting place.
2. No. An API is *one company's* menu into *their* system; they control and can revoke it. A protocol is
   a shared spec many independent parties implement, so no single one can lock the others out. A rich
   API can still belong to a walled garden.
3. Because the "network" is the public rules, not a private user base. Speaking the protocol instantly
   connects the newcomer to everyone already following it — it doesn't have to recruit both sides itself.

</details>

## Key terms

**Platform**, **walled garden**, **protocol**, **interoperability**, **API** (contrast), **open
network**, **lock-in**. See the [Glossary](./GLOSSARY.md).

Next: **[03 · Digital Public Infrastructure](./03_dpi.md)** — what happens when society builds shared
protocols as *public* rails.
