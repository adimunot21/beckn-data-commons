# 03 · Digital Public Infrastructure (DPI)

## Learning objectives

After this module you'll be able to explain:

- What **infrastructure** is, and what makes it **public**.
- What **Digital Public Infrastructure (DPI)** means, with the **India Stack** as the leading example.
- The **UPI story** — how open payment rails beat walled-garden payment apps — in enough detail to use
  it as *the* reference example for the rest of the course.
- What **unbundling** means, and why DPI produces competition and inclusion instead of monopoly.
- What **ONDC** is, and why Beckn Data Commons is "an ONDC-style idea, but for datasets."

## Infrastructure, and what "public" adds

**Infrastructure** is the shared, boring, essential stuff that everything else is built on top of:
roads, electricity, water, the postal system. You don't think about roads when you drive to a shop — you
just use them, and so does everyone else, including your competitors. That's the whole point of
infrastructure: it's a *shared foundation* nobody has to rebuild.

**Public** infrastructure is infrastructure that is *open to all on equal terms* and not owned by one
private company for its own advantage. Anyone can drive on a public road — a delivery giant and a
one-person bakery use the same asphalt. Imagine instead if one company owned all the roads and could
decide who drives, charge rivals more, or block competitors. That's the difference between public and
private infrastructure — and it's exactly the platform-vs-protocol difference from Module 2, applied to
society's shared rails.

## Digital Public Infrastructure

**Digital Public Infrastructure (DPI)** is that same idea for the digital world: shared digital rails —
for identity, payments, data sharing, and now *commerce* — built as **open protocols** that anyone's
software can build on, rather than as walled-garden platforms owned by one company.

The clearest real-world example is the **India Stack**: a set of national digital rails that unbundled
things which, elsewhere, big private platforms had bundled up and locked down.

## The UPI story (learn this one well)

The single best illustration of why DPI matters is **UPI** (Unified Payments Interface), India's
instant-payments network. It's worth understanding because it's the template Beckn Data Commons copies.

**Before UPI**, digital payments looked like Module 2's walled garden. Each wallet app was an island: if
your money was in wallet A and your friend used wallet B, you often *couldn't* pay them directly — both
sides had to be inside the same private app. Each company fought to lock in users, because being the
biggest island was the whole game.

**UPI made payments a protocol.** It defined open rules for "move money from any account at any bank to
any account at any bank." Now:

- Your friend's app and your app can be totally different companies — the payment still goes through,
  because both speak UPI.
- **Hundreds of apps** compete to be the nicest way to *use* UPI, but none of them owns the rails, so
  none can trap you. Don't like your app? Switch; your money and contacts aren't hostage.
- A tiny startup can build a payments app in a weekend and instantly reach *everyone* on UPI — no need
  to sign up every bank first. (That's the chicken-and-egg problem, solved by the protocol.)

The result was an explosion of both **competition** (many apps, improving fast) and **inclusion** (a
street vendor can accept a digital payment with a printed code and no expensive card machine). Power
that would have pooled inside one or two dominant wallet companies instead spread across an open market.

Two other India Stack pieces round out the picture:

- **Aadhaar** — a digital identity rail, so any service can verify "this person is who they claim"
  without each building its own identity silo.
- **DigiLocker** — a rail for holding and sharing official documents, so you can *present* a verified
  document instead of emailing a photocopy.

## Unbundling — the move that makes DPI work

The deep trick behind DPI is **unbundling**: take the capabilities a platform *bundles* together —
identity, payments, discovery, data, trust — and turn each into its own open, shared rail that anyone
can plug into.

A walled-garden platform bundles them *so you can't leave*: your identity, your payment method, your
order history, and your relationships all live inside the one app. Unbundle them into public rails, and
suddenly no single company holds all the pieces, so no single company can hold you.

Beckn Data Commons does exactly this unbundling for a data market. Watch for it:

- **Discovery** (finding datasets) becomes an open protocol — the seller isn't trapped in one catalog.
- **Consent** (permission to use data) becomes its *own* separate rail, run by a party that doesn't even
  hold the data (Module 5). That separation is unbundling in action.

## ONDC — a protocol for shopping, and our direct inspiration

The India Stack's newest layer is **ONDC** (Open Network for Digital Commerce): an attempt to do to
*e-commerce* what UPI did to payments. Instead of two giant shopping platforms owning all buyers and
sellers, ONDC is an **open network** where any buyer app can discover and order from any seller app that
joins — the Module 2 picture, made real for shopping.

ONDC is built on an open protocol called **Beckn** — the subject of the next module. And here's the
one-line pitch for the whole project you're studying:

> **Beckn Data Commons is an ONDC-style open network — but instead of shops and products, the sellers
> offer machine-learning datasets and models, and access is governed by a consent artifact instead of a
> download link.**

Everything from here builds on that sentence.

## Why this beats the alternative

The alternative to DPI is letting a few private platforms own each essential digital function — payments,
identity, commerce, and now *data and AI*. That concentrates power, taxes small players, blocks
interoperability, and excludes anyone the platform doesn't find profitable. DPI's bet is that the
essential rails should be **public protocols**, so competition and inclusion happen *on top* of them.
UPI is the proof it works at national scale. Beckn Data Commons applies the same bet to the coming market
for data and AI — a market where "who controls access" is about to matter enormously.

## Where this lives in the project

The project's own framing calls it a "**Beckn-native, consent-governed dataset & model exchange**" — an
open network, not a data-broker site. See the goal statement in
[`PROJECT_PLAN.md`](../PROJECT_PLAN.md). The "consent as its own rail" idea (unbundling) becomes the
**Access Manager**, a separate service you'll meet in Module 7.

## Check your understanding

1. What makes infrastructure "public," and how does that map onto Module 2's protocol-vs-platform idea?
2. Tell the UPI story in three sentences: what payments looked like before, what UPI changed, and the
   two big results.
3. What does "unbundling" mean, and what are the two things Beckn Data Commons unbundles?
4. Fill in the blank: "Beckn Data Commons is like **ONDC**, but the sellers offer ______ instead of
   retail products."

<details>
<summary>Answers</summary>

1. Public infrastructure is open to all on equal terms and not owned by one company for its own
   advantage (like public roads). That's the *protocol* side of Module 2's contrast, applied to
   society's shared digital rails.
2. Before: each payment wallet was a walled-garden island and you often couldn't pay across apps. UPI
   made payments an open protocol so any app can pay any account at any bank. Results: an explosion of
   **competition** (many apps, no owner of the rails) and **inclusion** (anyone, even a tiny vendor, can
   transact).
3. Unbundling = splitting a platform's bundled capabilities into separate open rails anyone can plug
   into. BDC unbundles **discovery** (an open protocol for finding datasets) and **consent** (a separate
   rail/authority for permission, run by a party that doesn't hold the data).
4. Machine-learning **datasets and models** (with access governed by a consent artifact, not a download
   link).

</details>

## Key terms

**Infrastructure**, **public**, **DPI**, **India Stack**, **UPI**, **Aadhaar**, **DigiLocker**,
**unbundling**, **ONDC**, **Beckn** (preview). See the [Glossary](./GLOSSARY.md).

Next: **[04 · The Beckn Protocol](./04_beckn.md)** — the open rails our whole system runs on.
