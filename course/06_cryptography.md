# 06 · Just Enough Cryptography

## Learning objectives

After this module you'll be able to explain, without any math:

- Why an **open network can't just trust messages** at face value.
- What a **hash** is (a digital fingerprint).
- What a **public/private key pair** is, and what a **digital signature** proves.
- Why we sign a **canonical** version of the data (why byte-for-byte matters).
- The **offline check vs. online check** split — and why a signed slip *still* needs a revocation
  lookup.
- What a **replay attack** is and how a **nonce** stops it.

You need exactly this much crypto to understand the permission slip. No more.

## The trust problem on an open network

On a walled-garden platform, trust is easy: there's one company, everyone logs into it, and it vouches
for everything. But we chose an **open network** (Modules 2–4), where independent apps send each other
plain messages over the internet. That raises two uncomfortable questions the platform hid from us:

1. **Who really sent this message?** Anyone can *type* "from: the Access Manager" at the top of a
   message. How does the receiver know it's genuine and not an impostor?
2. **Was it changed on the way?** A message passes through many computers. How does the receiver know no
   one altered it — say, changing "valid for 1 hour" to "valid for 1 year," or "these 3 columns" to "all
   columns"?

Cryptography answers both. The tools sound intimidating; the ideas are simple.

## Hashing — a digital fingerprint

A **hash function** takes any data — a word, a file, a whole dataset — and produces a short, fixed-length
string of gibberish called a **hash**. Three properties make it useful:

- **Same input → same hash, every time.**
- **Any change to the input → a completely different hash.** Change one comma and the fingerprint is
  unrecognizable.
- **You can't run it backwards.** From the hash you can't reconstruct the input.

So a hash is a **fingerprint**: a tiny value that stands in for a big piece of data, and that changes
totally if the data changes even slightly. If I tell you the fingerprint of a document and later you
compute the fingerprint of the document you received, matching fingerprints mean *"not one byte
changed."*

## Keys and signatures — a sealed, un-forgeable letter

Now the centerpiece. A **key pair** is two matched keys generated together:

- a **private key**, which you keep utterly secret, and
- a **public key**, which you hand out to everyone.

They have a magical relationship: something done with the **private** key can be *checked* by anyone
holding the matching **public** key — but the public key can't be used to *do* it. It's a one-way
partnership.

A **digital signature** uses this to prove authorship and integrity at once. To **sign** a message, I use
my *private* key to produce a special stamp (the signature) over that exact message. Anyone with my
*public* key can then **verify**: "yes, this signature was made by the holder of the private key that
matches this public key, *and* the message hasn't changed since." If even one byte of the message is
altered, verification fails.

The everyday analogy: a signature is like a **wax seal on a letter that only your ring can make**. Anyone
can recognize your seal (public key), but only your ring (private key) can produce it — and if someone
steams the letter open and edits it, the seal breaks. A digital signature is that, but unforgeable and
mathematically checkable.

> The specific signature scheme this project uses is called **Ed25519**. You don't need its internals —
> just "modern, fast, widely trusted digital signatures." Keys and signatures are written as long strings
> of hex characters (`0-9`, `a-f`).

This directly answers our two trust questions:

- *Who sent it?* → Whoever holds the private key matching a public key you trust. (And the **registry**
  from Module 4 is where you look up "which public key belongs to the Access Manager.")
- *Was it changed?* → If it had been, the signature wouldn't verify.

## Why "canonical" JSON matters

Here's a subtlety that trips people up. A signature is over *exact bytes*. But the same JSON data can be
written in different ways — keys in a different order, extra spaces — that *mean* the same thing but are
*different bytes*:

```json
{"a":1,"b":2}          and          {"b":2, "a":1}
```

Same meaning, different bytes → different signatures → verification would fail for silly reasons. The fix
is to agree on **one canonical way** to write the data before signing: e.g., *always sort the keys, no
extra spaces.* This is **canonical JSON**. The signer canonicalizes, then signs; the verifier
canonicalizes the data it received the same way, then checks. Now both sides are guaranteed to be looking
at identical bytes, and the signature is reliable. (Our project has a small `canonicalJson` helper that
does exactly this; it even caught a real bug during development where the two sides could have
disagreed.)

## Offline check vs. online check — the clever split

Now we can state the single most important design idea about the permission slip.

Because the Access Grant is **signed**, anyone can verify — *with no phone call to anybody* — that:

- it's genuinely from the Access Manager (signature checks out),
- it hasn't been tampered with (same),
- it's still within its time window (the expiry is right there in the signed data),
- it's for the right provider, resource, and scope (all signed in).

That's the **offline check**: everything checkable from the slip itself plus the issuer's public key. It's
what makes the grant a real, *self-contained*, independently-verifiable artifact.

**But there's one thing a self-contained slip can *never* know: whether it was *revoked* after it was
signed.** Revocation happens *later*, so it can't be baked into the signed bytes. A perfectly valid,
correctly-signed, unexpired grant might still have been withdrawn five minutes ago.

So the slip needs one thing the signature can't provide: an **online check** — a quick look-up against a
shared "has this been revoked?" list, done at the moment of download. Combine them:

```
   OFFLINE (from the slip + public key, no network):
     signature valid?  within time window?  right provider/resource/scope?
   ONLINE (one lookup at download time):
     is this grant's id on the revoked list?
   → serve the data only if BOTH pass.
```

**Why both?** The expiry (offline) bounds how long a *leaked* slip could be abused. Revocation (online)
makes withdrawal *immediate*. Neither alone is enough: expiry-only can't undo a leak now; revocation-only
would mean phoning the authority to validate *everything*, losing the self-contained property. Enforcing
both is the exact security claim this project demonstrates — remember it; it's the punchline of Module 7
and you'll watch it happen in Module 11.

## Replay attacks and the nonce

One more threat, because our network signs *messages* between apps too (not just grants). Suppose an
eavesdropper can't forge or alter a message (signatures stop that) — but they copy a genuine, correctly
signed message and simply **send it again** later. That's a **replay attack**: reusing a real message to
make something happen twice (imagine replaying "confirm this order").

Two defenses, used together:

- **A short time window.** Each message says "valid from *now* until *now + 30 seconds*" (that `ttl` from
  Module 4). Replays outside the window are rejected.
- **A nonce.** A **nonce** is a random "use-once" number included in each message. The receiver remembers
  the nonces it has seen recently; if the same one shows up twice, the second is a replay and gets
  rejected. ("Nonce" = "number used once.")

## Why this beats the alternative

The alternative is "trust the label on the envelope" — which on an open network means trusting anyone who
can type. Cryptography replaces trust-by-assertion with trust-by-*proof*: a signature *proves* origin and
integrity to *anyone*, with no central authority vouching in real time. That's what lets a permission
slip be independently verifiable (offline) yet still revocable (online), and lets independent apps on an
open network believe each other's messages at all. Without this layer, the open network of Modules 2–4
would be unusably forgeable.

## Where this lives in the project

- The crypto primitives (hashing-style fingerprints, Ed25519 sign/verify, canonical JSON) live in
  `packages/crypto-utils/`.
- The offline+online grant check is in the data holder's download endpoint (`services/bpp/`), and the
  reasoning is spelled out in [`docs/consent-artifact-spec.md`](../docs/consent-artifact-spec.md) §5.
- Message signing, the time window, and nonce-based replay defense are described in
  [`docs/security.md`](../docs/security.md) — which is also the honest list of what's *not* yet defended.

## Check your understanding

1. What two questions does a digital signature answer for the receiver of a message?
2. Why must we sign *canonical* JSON rather than whatever bytes we happen to have?
3. A grant's signature is valid and it hasn't expired. Why might the data holder *still* refuse to serve
   the data — and which kind of check catches that?
4. What is a replay attack, and how does a nonce stop it?

<details>
<summary>Answers</summary>

1. **Who sent it** (only the holder of the matching private key could have signed it) and **whether it
   was changed** (any alteration breaks verification).
2. Because a signature is over exact *bytes*, and the same JSON can be written different ways (key order,
   spacing) that mean the same but are different bytes. Canonicalizing first guarantees signer and
   verifier compare identical bytes.
3. Because it may have been **revoked** after being signed — something the signed bytes can't know. The
   **online** revocation check (a lookup at download time) catches it; the signature/expiry checks are
   **offline** and can't.
4. Copying a genuine signed message and sending it again to make something happen twice. A **nonce**
   (random use-once number, remembered by the receiver) makes the replayed copy detectable, and a short
   time window limits the opportunity.

</details>

## Key terms

**Hash**, **key pair**, **private/public key**, **digital signature**, **Ed25519**, **canonical JSON**,
**offline vs. online verification**, **revocation**, **replay attack**, **nonce**, **ttl**. See the
[Glossary](./GLOSSARY.md).

Next: **[07 · Our System](./07_our_system.md)** — every idea so far, assembled into Beckn Data Commons.
