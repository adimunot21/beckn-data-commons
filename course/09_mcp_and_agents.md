# 09 · MCP & AI Agents

## Learning objectives

After this module you'll be able to explain:

- What an **LLM** and an **AI agent** are, in plain terms.
- What **tool use** (a.k.a. function calling) is — how a language model *does* things, not just talks.
- What **MCP** (Model Context Protocol) is, and the "**USB-C for AI tools**" analogy.
- Why wrapping Beckn Data Commons in an MCP server is the payoff of the whole project.
- What the **seven tools** are that let an agent run the entire flow in natural language.

## From "language model" to "agent"

An **LLM** (Large Language Model) is the kind of AI behind chat assistants — a system trained to predict
and produce text. On its own, an LLM only *talks*: you type, it writes back. It can't check today's data,
book anything, or download a file. It's a brilliant conversationalist locked in a room with no phone.

An **AI agent** is an LLM that's been given a way to *act* — to take actions in the world and use the
results. The difference between "assistant that describes how you might get a dataset" and "assistant
that actually goes and gets it" is the difference between an LLM and an agent. The bridge that turns one
into the other is **tool use**.

## Tool use (function calling)

**Tool use** means giving the model a menu of **tools** — specific actions it can request — and letting
it call them. Each tool has a name, a description, and a defined set of inputs (this is just an API menu
from Module 1, presented to the model). The flow is:

1. You describe the available tools to the model (e.g. a tool called `search_resources` that takes a
   query).
2. The user says something in plain English: *"find me a churn dataset."*
3. The model decides *"I should call `search_resources` with query = churn"* and emits that request.
4. Your code runs the tool for real, and hands the result back to the model.
5. The model reads the result and decides the next step — maybe call another tool, maybe answer.

So the model supplies the *judgment* ("which tool, with what inputs, in what order") and your tools supply
the *actions*. That loop is what makes an agent able to accomplish a multi-step task from one sentence.

## The problem MCP solves

Tool use created a mess. Every AI app invented its *own* way to describe and connect tools, so a tool
built for one assistant didn't work with another — the walled-garden problem from Module 2, all over
again, but for AI tools.

**MCP (Model Context Protocol)** is the fix, and notice it's the *same idea as the rest of this course*:
an **open protocol**, this time for connecting AI models to tools and data. Any MCP-speaking model
(Claude, and others) can use any MCP-speaking tool server, with no custom glue.

The standard analogy is **USB-C**. Before USB-C, every device had its own charger and cable; nothing
interchanged. USB-C is one open standard, so any USB-C charger powers any USB-C device. **MCP is USB-C
for AI tools**: one open standard for plugging capabilities into AI models, so anything that speaks it
interoperates. (It's protocols-not-platforms — Module 2 — reappearing at the AI layer. This theme is not
a coincidence; it's the whole worldview of the project.)

## Wrapping Beckn Data Commons in MCP — the payoff

Now the pieces snap together. We have an open network (Modules 2–4) where access is governed by signed,
revocable grants (Modules 5–7), running as real services (Module 8). The final move: put an **MCP server**
in front of it, exposing the network's actions as MCP **tools**.

The instant we do that, *any MCP-speaking agent — like Claude — can drive the entire network in plain
English.* No custom integration, no human clicking through steps. You say what you want; the agent
chooses and calls the tools; the network does its signed, consent-governed thing; you get your data.

A subtle but important design detail: this MCP server is **not** one more service inside the Docker
network. It runs on *your* machine and is launched by the AI client (e.g. Claude Desktop), then talks to
the running network over `localhost`. Think of it as the *adapter* between the agent on your computer and
the network — fittingly, the "USB-C plug" itself.

## The seven tools

The MCP server exposes the whole lifecycle from Module 7 as seven named tools. Read them and notice they
*are* the lifecycle:

| Tool | What the agent does with it | Lifecycle step |
| --- | --- | --- |
| `search_resources` | Find datasets/models by query, license, size, etc. | search |
| `view_resource` | Look at one result's full details | (inspect) |
| `request_access` | Preview the draft terms for an offer | select/init |
| `confirm_access` | Confirm and **obtain the signed Access Grant** | confirm + issue |
| `download` | Present the grant to the provider and get the data | download |
| `list_my_grants` | See the grants issued to me | (audit) |
| `revoke_grant` | Withdraw a grant | revoke |

So the one-sentence request from Module 0 —

> *"find me a small permissively-licensed churn dataset, at least 2,000 rows, and get me the data"*

— becomes, entirely on the agent's own initiative: `search_resources` → `view_resource` →
`confirm_access` (which reaches into the network, runs the Beckn transaction, and gets the Access Manager
to sign a grant) → `download` (which presents that grant to the provider and writes the file to disk).
Zero code written by the human. And if you then say *"actually, revoke that,"* the agent calls
`revoke_grant`, and the next `download` comes back **403**. You will do exactly this in Module 11.

## A note on the "NLU" idea (designed, not built)

The project's plan includes an optional stretch: training a small, local language model to translate
natural-language requests into the network's search format — a specialized **NLU** (Natural Language
Understanding) parser — and comparing it against a big general model. This is **designed but not built**
in the current system; the MCP + a general model already provides the natural-language interface. It's
mentioned so you know it exists in the roadmap, and we revisit it as a future direction in
[Module 10](./10_why_better.md). Don't expect to find it in the running code.

## Why this beats the alternative

The alternative to MCP is a custom, one-off integration between each AI app and each tool — brittle,
non-portable, and controlled by whoever wrote the glue (a walled garden again). MCP makes the network's
capabilities available to *any* compliant agent through an open standard, so the data commons isn't
captive to one AI product. It's the perfect capstone for a project whose entire thesis is "open protocols
beat walled gardens": the *access layer for agents* is itself an open protocol.

## Where this lives in the project

- The MCP server: `services/mcp-server/`, with a how-it-works walkthrough in
  [`docs/05_mcp.md`](../docs/05_mcp.md).
- How to register it with Claude and run the demo: [`docs/mcp-setup.md`](../docs/mcp-setup.md) — which
  you'll use in the capstone.

## Check your understanding

1. What's the difference between an LLM and an AI agent, and what bridges the two?
2. In the tool-use loop, what does the *model* provide and what do the *tools* provide?
3. What problem does MCP solve, and why is "USB-C for AI tools" a fair analogy?
4. Map three of the seven MCP tools onto the lifecycle steps from Module 7.

<details>
<summary>Answers</summary>

1. An **LLM** only produces text; an **AI agent** is an LLM that can also *act*. **Tool use** (function
   calling) bridges them by letting the model call defined actions and use the results.
2. The **model** provides judgment — which tool to call, with what inputs, in what order. The **tools**
   provide the real actions (and their results).
3. Every AI app had its own incompatible way to connect tools (a walled garden). MCP is an **open
   protocol** so any MCP model can use any MCP tool server — like USB-C being one open standard so any
   charger powers any device.
4. e.g. `search_resources` = search; `confirm_access` = confirm + issue the grant; `download` =
   download; `revoke_grant` = revoke. (Any correct mapping.)

</details>

## Key terms

**LLM**, **AI agent**, **tool use / function calling**, **MCP**, **MCP server/tool**, **NLU** (stretch),
**natural-language interface**. See the [Glossary](./GLOSSARY.md).

Next: **[10 · Why This Is Better](./10_why_better.md)** — the whole argument, laid out side by side.
