# 00 · Orientation — the problem, and where we're going

## Learning objectives

After this short module you'll be able to:

- Tell the one story that this entire system exists to fix.
- Name the four big ideas the course teaches and why they show up in that order.
- Hold a mental "map" so no later module feels like it comes out of nowhere.

## One story

Imagine you're building an AI assistant. You ask it:

> *"Find me a small, permissively-licensed dataset of customer churn — at least 2,000 rows — and get me
> the data so I can train a model."*

For the assistant to actually *do* this, four things have to happen:

1. **Find it.** It has to search across many data providers — not just one company's catalog.
2. **Agree to terms.** Datasets come with licenses ("you may use this for research, not resale"). Someone
   has to record what was agreed.
3. **Get permission.** The provider needs to hand over access — but *safely*.
4. **Download it.** The bytes finally arrive.

Today, step 3 is broken. When you get access to data online, you almost always get a **download link** —
a URL, maybe with a secret token baked in. That link has three deep problems:

- **It's invisible.** Nothing records *who* got access, *for what purpose*, or *for how long*. The
  permission is just... a URL that works.
- **It can't be taken back.** Once the link leaks — pasted in a chat, cached, forwarded — anyone who has
  it can pull the data. There's no "undo." The only thing that eventually stops it is expiry.
- **It's all-or-nothing.** The link either works or it doesn't. It can't say "you may see these three
  columns but not the rest," or "you agreed to research use only."

Now imagine an *AI agent* doing this thousands of times on your behalf. A world where agents pass around
invisible, un-revocable, unscoped download links is a world with no accountability. That's the problem.

## The fix, in one sentence

> Replace the invisible download link with a **signed, scoped, revocable permission slip** — and put the
> whole thing on an **open network** so any app or agent can participate, not just one company's.

That permission slip is the star of this system. We call it an **Access Grant**. By the end you'll know
exactly what's inside it, why it can't be forged, and why revoking it actually works.

## The four big ideas (and why this order)

To understand the fix, you need four ideas, and they build on each other:

1. **Open networks instead of walled gardens** (Modules 2–4). *Why* should this be an open network at
   all, and not just one company's website? This is the story of **protocols** and **Digital Public
   Infrastructure** — the same idea that let any bank's app pay any other bank's app in India. **Beckn**
   is the specific open protocol we build on.

2. **Consent as a first-class thing** (Module 5). Data isn't like a physical product — it's copyable and
   often sensitive — so *permission* deserves to be a real, recorded, revocable object. This is the
   **DEPA** idea: separate the party that *holds* data from the party that *manages consent*.

3. **Cryptography that makes the slip trustworthy** (Module 6). A permission slip is only worth something
   if it can't be forged, can't be altered, and can be checked by anyone. That's what **digital
   signatures** give us.

4. **Agents that can use it** (Module 9). Finally, we wrap the network so an AI agent can drive it in
   plain English. That's what **MCP** is for.

Modules 7 and 8 put it all together (what we built, and how it actually runs on a computer), Module 10
makes the "why it's better" argument in full, and Module 11 lets you run the real thing.

## The map

```
   THE WHY                           THE HOW
   ───────                           ───────
02 platforms are walls      →   07 our system (the Access Grant)
03 DPI opens the walls      →   08 the infrastructure (how it runs)
04 Beckn = the open rails   →   09 MCP (how an agent drives it)
05 data needs consent       →   10 why it beats the alternatives
06 crypto makes it safe     →   11 run it yourself
        (01 = the absolute basics everything above assumes)
```

If at any point you think *"wait, why are we doing it this way?"* — that's the right question, and every
module ends by answering it.

## Where this lives in the project

The technical version of this same overview (for a reader who already knows the jargon) is
[`docs/01_architecture.md`](../docs/01_architecture.md). You can peek, but you don't need it yet — this
course is the from-scratch path to understanding it.

## Check your understanding

1. What are the three specific problems with a plain download link?
2. In one sentence, what does this system replace the download link with?
3. Why does it matter *more* that access be revocable when an **AI agent** is the one getting access?

<details>
<summary>Answers</summary>

1. It's **invisible** (nothing records who/why/how-long), it **can't be revoked** (a leaked link keeps
   working until it expires), and it's **all-or-nothing / unscoped** (can't limit purpose or which parts
   of the data).
2. A signed, scoped, revocable **Access Grant** on an open network.
3. An agent may obtain and pass around access at machine speed and scale; without revocation or
   scoping there is no way to correct a mistake or withdraw consent after the fact — the blast radius is
   much larger than one human clicking one link.

</details>

## Key terms

**Access Grant**, **open network**, **protocol**, **DPI**, **DEPA / consent**, **digital signature**,
**agent**, **MCP** — all defined as we go, and collected in the [Glossary](./GLOSSARY.md).

Next: **[01 · Foundations](./01_foundations.md)** — the absolute basics everything else assumes.
