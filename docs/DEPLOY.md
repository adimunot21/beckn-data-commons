# Deploying Beckn Data Commons

This is the runbook to put the network on the public internet, with HTTPS, on the **cheapest viable
path** — one small VPS running the same `docker compose` you run locally, behind
[Caddy](https://caddyserver.com/) for automatic TLS. No paid domain is required.

**What gets deployed:** the backend network — the BAP, three BPPs, the Access Manager, Postgres, Redis,
and Caddy. **What does not:** the MCP server. It's a host-run stdio bridge (see
[`mcp-setup.md`](./mcp-setup.md)); after deploying you point a *local* MCP server at the public URLs
(Step 8).

> **Before you start — the honest cost & safety notes**
> - A VPS that comfortably runs this costs about **US$4–6/month** (1 GB RAM is enough; 2 GB comfortable).
>   You can destroy it the moment you're done. There is **no free-forever** VPS that fits well, but most
>   providers give trial credit.
> - This build's **revoke/list grant endpoints are unauthenticated** (a documented, DoS-only limitation —
>   see [`security.md`](./security.md)). Treat a public deployment as a **short-lived demo**, not a
>   production service. When you're finished, tear it down (Step 9).
> - All datasets are **synthetic**, so there's no data-licensing or personal-data concern in exposing
>   them.

---

## Step 1 — Get a server

Create the cheapest small **Ubuntu 24.04** VPS from any provider (DigitalOcean, Hetzner, Linode, Vultr…):
1 vCPU, ~1–2 GB RAM, a public IPv4. You'll get an IP address and SSH access. Note the **IP** — call it
`SERVER_IP` below.

Open the firewall for **ports 22 (SSH), 80, and 443** (most providers open these by default; some have a
cloud firewall you must adjust).

SSH in:

```bash
ssh root@SERVER_IP
```

Everything from here runs **on the server** unless noted.

## Step 2 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

## Step 3 — Get the code and toolchain

You need the repository (to build the images) and Node/pnpm (only to generate keys).

```bash
# the code
git clone https://github.com/adimunot21/beckn-data-commons.git
cd beckn-data-commons

# Node 22 + pnpm (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm install 22 && corepack enable
pnpm install
```

## Step 4 — Choose your public hostname

Caddy needs a **hostname** to fetch a real TLS certificate — a bare IP can't get one. Two options:

- **Free, no domain (recommended for a demo): `sslip.io`.** Any address like
  `SERVER_IP.sslip.io` automatically resolves to `SERVER_IP` — and Caddy *can* get a real Let's Encrypt
  certificate for it. If your IP is `203.0.113.10`, your hostname is `203.0.113.10.sslip.io`. Nothing to
  register.
- **Your own domain:** point an `A` record at `SERVER_IP` and use that name.

Set it aside as `PUBLIC_HOST` for the next step.

## Step 5 — Generate the secrets

The network won't boot without its keys ([`security.md`](./security.md)). Generate them **on the
server**:

```bash
# Access Manager grant-signing keypair
pnpm --filter @bdc/access-manager gen-keys

# Per-participant message-auth keys + the shared registry
node infra/gen-beckn-keys.mjs
```

## Step 6 — Assemble the env file

Copy the template and fill it in with the hostname, a strong DB password, and the values you just
generated:

```bash
cp infra/env.prod.example infra/.env.prod
nano infra/.env.prod    # or your editor of choice
```

- `PUBLIC_HOST` → e.g. `203.0.113.10.sslip.io`
- `POSTGRES_PASSWORD` → a strong random string (`openssl rand -hex 24`)
- `AM_PRIVATE_KEY`, `ACCESS_MANAGER_PUBLIC_KEY` → from the `gen-keys` output
- the four `*_BECKN_PRIVATE_KEY` lines and `BECKN_REGISTRY` → from the `gen-beckn-keys.mjs` output

`infra/.env.prod` is gitignored — it holds your private keys; never commit it.

## Step 7 — Launch

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up --build -d
```

First build takes a few minutes. Then check everything is healthy:

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
```

Caddy fetches the TLS certificate on first request (a few seconds). Verify from **your own laptop**:

```bash
curl -s https://PUBLIC_HOST/bap/health
# → {"status":"ok","service":"bap", ...}
```

If you see a valid response over **https**, you're live. (If the cert isn't ready, wait ~30s and retry;
Caddy logs are `docker compose ... logs caddy`.)

### Try the full flow over the internet

The same sequence as the [course capstone](../course/11_capstone.md), now against your public host — run
these **from your laptop**, replacing `PUBLIC_HOST`:

```bash
# search
TXN=$(curl -s -X POST https://PUBLIC_HOST/bap/search \
  -H 'content-type: application/json' -d '{"intent":{"query":"churn"}}' | jq -r .transactionId)

# confirm → get a signed grant
curl -s -X POST https://PUBLIC_HOST/bap/confirm -H 'content-type: application/json' \
  -d "{\"transactionId\":\"$TXN\",\"bppId\":\"bpp.tabular.local\",\"offerId\":\"offer-churn-full\",\"resourceId\":\"ds-churn\",\"grantee\":{\"id\":\"demo\"},\"purpose\":\"train\",\"licenseClass\":\"permissive\"}" > confirm.json
jq '.grant.claims' confirm.json

# download (encode the grant, present it) — should be HTTP 200
jq -c .grant confirm.json > grant.json
ENC=$(python3 -c 'import base64;print(base64.urlsafe_b64encode(open("grant.json","rb").read()).decode().rstrip("="))')
curl -s -o churn.csv -w 'HTTP %{http_code}\n' \
  "https://PUBLIC_HOST/bpp-tabular/download?resourceId=ds-churn&offerId=offer-churn-full" \
  -H "Authorization: Grant $ENC"

# revoke, then the same download → HTTP 403
GID=$(jq -r .grant.claims.grantId confirm.json)
curl -s -X POST "https://PUBLIC_HOST/am/grants/$GID/revoke" -H 'content-type: application/json' -d '{"reason":"demo"}'
curl -s -o /dev/null -w 'after revoke: HTTP %{http_code}\n' \
  "https://PUBLIC_HOST/bpp-tabular/download?resourceId=ds-churn&offerId=offer-churn-full" \
  -H "Authorization: Grant $ENC"
```

## Step 8 — Point an MCP client at the live network (optional)

To drive the deployed network from Claude, register the MCP server **on your laptop** exactly as in
[`mcp-setup.md`](./mcp-setup.md), but set the URLs to your public host:

```json
{
  "mcpServers": {
    "beckn-data-commons": {
      "command": "node",
      "args": ["/absolute/path/to/services/mcp-server/dist/index.js"],
      "env": {
        "BAP_URL": "https://PUBLIC_HOST/bap",
        "ACCESS_MANAGER_URL": "https://PUBLIC_HOST/am",
        "DOWNLOAD_DIR": "/home/you/bdc-downloads"
      }
    }
  }
}
```

Now ask Claude to find a dataset and get the data — it drives your *internet-hosted* network.

## Step 9 — Tear down

When the demo is over, stop paying and remove the exposure:

```bash
# on the server
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml down       # stop
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml down -v     # + delete data volumes
```

Then **destroy the VPS** from your provider's dashboard so it stops billing.

---

## Notes & where to go next

- **HTTPS on a bare IP (no `sslip.io`, no domain):** set `PUBLIC_HOST` to the IP and change the Caddy
  site to use `tls internal` (a self-signed cert) — browsers will warn, and `curl` needs `-k`. The
  `sslip.io` route avoids all that with a real cert.
- **Hardening before anything long-lived:** authenticate the revoke endpoint, add proof-of-possession to
  grants, and consider mTLS between participants — the full list is in [`security.md`](./security.md).
- **Auto-deploy on push:** a GitHub Actions workflow could SSH to the server and re-run the compose `up`
  on each push to `main`. Left out here because it needs an SSH deploy key stored as a repo secret;
  add it once you have a permanent server.
- **What changed from the local compose:** only Caddy is exposed (80/443); every other service is
  internal-only; each BPP's `BPP_URI` is the public HTTPS path so download links work remotely; inter-
  service traffic and BAP callbacks stay on the internal Docker network exactly as tested.
