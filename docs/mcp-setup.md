# MCP Setup — driving BDC from Claude

The BDC MCP server (`services/mcp-server`) is a **host-run stdio bridge**: your MCP client
(Claude Desktop or Claude Code) launches it as a subprocess, and it talks to the running BDC backend
over `localhost`. It is not one of the Docker containers.

## 1. Start the backend

```bash
# from the repo root, with an Access Manager keypair exported (see README)
docker compose -f infra/docker-compose.yml up -d
```

This runs Postgres, Redis, the BAP (`:3001`), three BPPs (`:3002/:3012/:3022`), and the Access
Manager (`:3003`).

## 2. Build the MCP server

```bash
pnpm --filter @bdc/mcp-server build   # produces services/mcp-server/dist/index.js
```

## 3. Register it with your MCP client

The server is configured entirely by environment variables:

| Var | Default | Meaning |
| --- | --- | --- |
| `BAP_URL` | `http://localhost:3001` | BAP base URL |
| `ACCESS_MANAGER_URL` | `http://localhost:3003` | Access Manager base URL |
| `GRANTEE_ID` | `claude-agent` | identity grants are issued to |
| `DOWNLOAD_DIR` | `~/bdc-downloads` | where downloaded files are written |

**Claude Code** (`.mcp.json` in a project, or `claude mcp add`):

```json
{
  "mcpServers": {
    "beckn-data-commons": {
      "command": "node",
      "args": ["/home/adimunot21/projects/data-commons/services/mcp-server/dist/index.js"],
      "env": { "DOWNLOAD_DIR": "/home/adimunot21/bdc-downloads" }
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`): the same `mcpServers` block.

## 4. Use it in natural language

Once registered, ask Claude:

> "Find me a permissively-licensed tabular dataset for churn prediction with at least 2,000 rows,
> then get me the data."

Claude will call, in order: `search_resources` → `view_resource` → `confirm_access` (which obtains a
signed Access Grant from the Access Manager) → `download` (which presents the grant to the provider
and writes the file to `DOWNLOAD_DIR`). No code written by the human in the loop.

## Tools

| Tool | Does |
| --- | --- |
| `search_resources` | discover datasets/models by task/modality/license/rows/text (BAP fan-out) |
| `view_resource` | full catalog metadata for one offer |
| `request_access` | Beckn select+init to preview the draft contract (optional) |
| `confirm_access` | confirm + obtain a signed, scoped, revocable Access Grant |
| `download` | present the grant to the provider and retrieve the file |
| `list_my_grants` | list grants issued to this agent |
| `revoke_grant` | revoke a grant (provider then refuses any download with it) |
