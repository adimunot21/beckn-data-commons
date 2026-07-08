# 01 · Foundations — the absolute basics

## Learning objectives

After this module you'll be able to explain, in plain words:

- The difference between a **program** and a **service (server)**.
- What a **client** and a **server** are, and what **"localhost"** and a **port** mean.
- What the **internet** and **HTTP** actually do when you load a page.
- What an **API** is and what **JSON** looks like.
- What a **request** and a **response** are — the heartbeat of everything that follows.

If you already know this, skim it. Everything later assumes exactly this much and no more.

## A program vs. a service

A **program** is a set of instructions a computer runs. When you open a calculator app, run it, and
close it, that's a program with a beginning and an end.

A **service** (also called a **server**) is a special kind of program that **starts up and then waits**,
possibly for months, answering requests from other programs. A restaurant kitchen is a service: it
doesn't cook one meal and shut down — it opens, then waits for orders, cooking each as it comes.

Beckn Data Commons is made of several services that start up and wait: one that answers "search"
requests, ones that hold datasets, one that issues permission slips. They wait, they talk to each other,
they answer.

## Client and server

Whenever two programs talk, one asks and one answers:

- The **client** is the one that *asks*. (Your web browser is a client.)
- The **server** is the one that *answers*. (The website's computer is a server.)

"Client" and "server" are roles, not brands — a program can be a server to one thing and a client to
another. In our system, the "buyer app" is a client when it asks a "seller app" for its catalog, and
that same buyer app is a *server* when it later receives the answer. (Why answers come back *separately*
is a real and important twist we'll get to in Module 4.)

### Localhost and ports

Every computer can talk to itself using a special name: **`localhost`** (it means "this very machine").
When you run all the services on your own laptop — which is exactly what we'll do in Module 11 — they
find each other at `localhost`.

But one computer runs many services at once. How do they not collide? Each service listens on a
numbered **port** — think of a big office building (`localhost`) with numbered doors. Our services live
at doors like `3001`, `3002`, `3003`. So `localhost:3001` means "the service behind door 3001 on this
machine." That's all a port is: a numbered door.

## The internet and HTTP

The **internet** is just an enormous number of computers able to send each other messages. To send a
message you need the other computer's **address** (like `bpp.example.com` or `localhost:3002`).

**HTTP** (HyperText Transfer Protocol) is the most common **set of rules** for those messages on the
web — the shared etiquette both sides follow. (That "set of rules" idea is so central that Module 2 is
entirely about it. HTTP is our first example of a *protocol*.)

Every time you load a web page, your browser sends an HTTP **request** ("please give me this page") and
the server sends back an HTTP **response** (the page). Two kinds of HTTP request matter for us:

- **GET** — "give me something." (Loading a page, downloading a file.)
- **POST** — "here's some data; do something with it." (Submitting a form, sending a search.)

Responses carry a **status code**, a 3-digit number that says how it went. You only need a handful:

| Code | Means |
| --- | --- |
| **200** | OK — here's what you asked for. |
| **401** | Unauthenticated — I don't know who you are / you didn't prove it. |
| **403** | Forbidden — I know who you are, but you're not allowed this. |
| **404** | Not found. |

Hold onto **200**, **401**, and **403** — in Module 11 you'll watch a download return **200**, then
watch the *same* download return **403** the instant its permission is revoked. That single flip is the
whole project in one screen.

## APIs — how programs talk to programs

A web page is meant for *humans* to read. But programs need to talk to programs, and a program doesn't
want a pretty page — it wants clean data. An **API** (Application Programming Interface) is the "menu"
of requests a service offers to *other programs*.

If a website is the dining room, the API is the kitchen's order slip: a fixed set of things you can ask
for, in a fixed format. Our search service, for example, offers an API request called `/search`. You
POST it a description of what you want; it answers with matching datasets. No web page, just data.

## JSON — the format of that data

When programs exchange data, they need an agreed shape for it. The most common one is **JSON**
(JavaScript Object Notation). It's just text, and it's readable by humans too. It has:

- **objects** — labelled bundles, wrapped in `{ }`, with `"key": value` pairs;
- **lists** — ordered sequences, wrapped in `[ ]`;
- **values** — text (`"hello"`), numbers (`42`), true/false, or nested objects/lists.

Here's a taste — a stripped-down version of a real message from our system:

```json
{
  "intent": { "query": "churn", "minRows": 2000 },
  "purpose": "train a churn model"
}
```

That's a search request: an object with an `intent` (itself an object) and a `purpose` (text). When you
see big blocks of `{ }` and `[ ]` later, don't panic — it's always just labelled bundles and lists.

## Request → response: the heartbeat

Put it together and you have the pattern that *everything* in this course is built from:

```
client ──── request (GET or POST, maybe carrying JSON) ────▶ server
client ◀─── response (a status code + maybe JSON) ─────────  server
```

Search is a request/response. Getting a permission slip is a request/response. Downloading data is a
request/response. Revoking access is a request/response. Once you see this heartbeat, the rest of the
system is just *who* is asking *whom*, and *what's in the messages*.

## Why this framing beats "it's all magic"

You could treat the internet as magic and still use it. But you couldn't reason about **trust**: if a
message is just bytes arriving at a door, how does the receiver know *who* sent it, or whether it was
*tampered with* on the way? Seeing clearly that everything is "a request with some JSON arriving at a
port" is exactly what lets us ask the sharp security questions in Modules 5 and 6 — and understand the
answers.

## Where this lives in the project

Our services are ordinary HTTP servers. You'll see addresses like `http://localhost:3001` (the buyer
app) and `http://localhost:3003` (the permission issuer) throughout, and requests like `POST /search`
and `GET /download`. They're all just the request/response heartbeat above.

## Check your understanding

1. What's the difference between a client and a server?
2. What does `localhost:3002` mean?
3. You ask a service for a file and get back **403**. What does that tell you — and how is it different
   from **401**?
4. In one sentence, what is an API?

<details>
<summary>Answers</summary>

1. The **client** asks (sends the request); the **server** answers (sends the response). They're roles,
   and one program can play both at different moments.
2. "The service listening on door (port) **3002** on **this same machine**."
3. **403 Forbidden** = the server knows who you are but you're **not allowed** this thing. **401
   Unauthenticated** = you haven't proven who you are at all. (403 is "no"; 401 is "who are you?")
4. An API is the fixed menu of requests a service offers to *other programs* (usually exchanging JSON).

</details>

## Key terms

**Program**, **service/server**, **client**, **localhost**, **port**, **HTTP**, **GET/POST**, **status
code (200/401/403)**, **API**, **JSON**, **request/response**. All in the [Glossary](./GLOSSARY.md).

Next: **[02 · Platforms vs. Protocols](./02_platforms_vs_protocols.md)** — why today's internet
concentrates power, and the alternative.
