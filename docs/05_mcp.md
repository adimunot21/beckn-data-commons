# 05 · MCP server — how an LLM agent drives the network

The MCP server is the payoff: it exposes the whole BDC flow as Model Context Protocol tools, so Claude
(Desktop / Code) can run *"find me a permissively-licensed churn dataset and get me the data"* end to
end — search, obtain a signed grant, download the file — with no code written by the human in the loop.

This doc is *how it works*; [mcp-setup.md](./mcp-setup.md) is *how to run it*.

`services/mcp-server/src/` — no database; one process per client connection.

## It's a host-run bridge, not a backend service

Unlike the BAP/BPP/AM, the MCP server is **not** a Docker container. An MCP client launches it as a
**stdio subprocess** and it talks to the running backend over `localhost`. That shapes two things:

- **stdout is the MCP protocol channel** — the server must never `console.log`; all diagnostics go to
  stderr (`index.ts`).
- Its download URLs and API base URLs point at the host-published ports of the Docker network.

## Three thin layers

The design keeps the MCP surface dumb and testable:

| Layer | File | Responsibility |
| --- | --- | --- |
| **Gateway** | `gateway.ts` | HTTP client to the BAP (search/select/init/confirm), the AM (list/revoke), and a BPP download endpoint — behind a `BdcGateway` interface |
| **Session** | `session.ts` | per-connection memory: flattens a search's catalogs into addressable offers, and tracks obtained grants so download/revoke can act on them |
| **Tools** | `server.ts` | the 7 MCP tools — pure translators from tool arguments to gateway calls, formatting results as text |

Because the gateway is an interface, the entire tool surface is tested with a **fake gateway** over the
SDK's in-memory transport (`server.test.ts`) — a real MCP `Client` drives the real server, no network.

## The seven tools

| Tool | Does |
| --- | --- |
| `search_resources` | discover datasets/models by task / modality / license / min-rows / free text (BAP fan-out) |
| `view_resource` | full catalog metadata for one offer |
| `request_access` | Beckn select+init to preview the draft contract (optional step) |
| `confirm_access` | confirm the transaction and obtain a signed, scoped, revocable Access Grant |
| `download` | present the grant to the provider and write the file to `DOWNLOAD_DIR` |
| `list_my_grants` | list grants issued to this agent |
| `revoke_grant` | revoke a grant (the provider then refuses any download with it) |

## Why the session state matters

MCP tools are individual calls, but the flow is stateful: `confirm_access` needs the `bppId`, `bppUri`,
`resourceId`, and license class of an offer the *previous* `search_resources` returned; `download` needs
the grant `confirm_access` just obtained. `session.ts` holds exactly that — search results keyed by
`offerId`, and grants keyed by `grantId` (with the resolved download URL) — so the agent can refer to an
offer by id across calls. One process per connection makes in-memory state correct here.

## Files

| File | What it holds |
| --- | --- |
| `config.ts` | env → `McpConfig` (BAP/AM URLs, grantee id, download dir) |
| `gateway.ts` | `BdcGateway` interface + `HttpBdcGateway`; grant → `Authorization: Grant` encoding |
| `session.ts` | `BdcSession`: offer flattening, grant tracking |
| `server.ts` | `createServer` registering the 7 tools |
| `index.ts` | stdio transport boot; stderr-only logging |

## The demo, concretely

With the backend up and the server registered (see [mcp-setup.md](./mcp-setup.md)), a single request
produces: `search_resources` → `view_resource` → `confirm_access` (which calls the BAP, which calls the
AM, which signs a grant) → `download` (which presents the grant to the BPP and writes a real CSV to
disk). Ask Claude to revoke, and the next download is refused. That is the entire BDC thesis, driven in
natural language.

## Reading order

`gateway.ts` (the backend calls) → `session.ts` (the state) → `server.ts` (the tools) → `index.ts`.
