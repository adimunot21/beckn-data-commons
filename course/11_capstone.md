# 11 · Capstone — Run It Yourself

## Learning objectives

This is the payoff. You'll boot the real Beckn Data Commons network on your own computer and, with your
own eyes, watch:

- a **signed search** fan out to three providers and come back with real catalogs,
- a **grant** get issued and inspect what's actually inside it,
- a real **dataset download** succeed (HTTP **200**),
- that grant get **revoked**,
- the **same** download now **refused** (HTTP **403**) — even though the grant is still signed and
  unexpired.

That last flip is the entire course in one moment. Everything you've learned will be visible on your
screen.

> **Time:** ~20–30 minutes, most of it Docker downloading things the first time.
> **You do not need to understand any code.** You'll copy-paste commands and read the output.

## What you need

- A computer running Linux, macOS, or Windows.
- **Docker** (with Docker Compose) — the one tool from [Module 8](./08_infrastructure.md). If you don't
  have it: install **Docker Desktop** (Mac/Windows) or **Docker Engine** (Linux) from docker.com, then
  confirm it works:
  ```bash
  docker --version
  docker compose version
  ```
- **Node.js** (version 22) and **pnpm** — used only to generate keys and build. Install Node from
  nodejs.org, then `corepack enable` (that gives you pnpm).
- The project code, opened in a terminal at its top folder (the one containing `infra/`, `services/`,
  `docs/`).
- A couple of tiny helpers most systems already have: `curl` (to send requests), `jq` (to pretty-print
  JSON), and `python3` (to encode one value). On Ubuntu: `sudo apt install jq`.

Throughout, remember [Module 1](./01_foundations.md): every command below is just sending a
**request** to a **service** and reading the **response**.

---

## Step 1 — Generate the keys

The network runs on cryptography ([Module 6](./06_cryptography.md)), so first we mint the key pairs: one
for the Access Manager (to sign grants) and one per participant (to sign messages). Two commands, run
from the project root:

```bash
# The Access Manager's grant-signing keypair:
pnpm --filter @bdc/access-manager gen-keys > infra/am-keys.env

# One message-signing keypair per participant, plus the shared "who-trusts-whom" registry:
node infra/gen-beckn-keys.mjs > infra/beckn-keys.env
```

These write **secrets** to two files (that's why the project keeps them out of version control). Now load
them into your shell so Docker can use them:

```bash
set -a
source infra/am-keys.env
source infra/beckn-keys.env
set +a
```

> *What just happened:* you created the private keys that make grants and messages unforgeable, and a
> registry mapping each participant to its public key — exactly the "phone book of keys" from
> [Module 4](./04_beckn.md).

## Step 2 — Boot the whole network (one command)

This is the [Module 8](./08_infrastructure.md) moment — the entire open network, seven services, from a
single wiring file:

```bash
docker compose -f infra/docker-compose.yml up --build -d
```

The first run downloads and builds things (a few minutes). When it settles, check they're all alive:

```bash
docker compose -f infra/docker-compose.yml ps
```

You want to see every service **healthy**: the buyer app (`bap`), three seller apps
(`bpp-tabular`, `bpp-image`, `bpp-models`), the `access-manager`, plus `postgres` and `redis`. That's
the network from [Module 7](./07_our_system.md), running on your laptop.

Quick sanity check that the buyer app answers (a `GET` to its health door):

```bash
curl -s http://localhost:3001/health
# → {"status":"ok","service":"bap","bapId":"bap.bdc.local", ... }
```

## Step 3 — Search (a signed `discover`, fanned out to 3 providers)

Ask the buyer app to search. It will sign a `discover` message, broadcast it to all three seller apps,
collect their signed `on_discover` callbacks in a short window, and return what came back — the whole
asynchronous dance from [Module 4](./04_beckn.md), all triggered by this one request:

```bash
curl -s -X POST http://localhost:3001/search \
  -H 'content-type: application/json' \
  -d '{"intent":{"query":"churn"},"purpose":"train a churn model"}' | jq
```

You'll get back a `transactionId` and catalogs. Two offers match — a full dataset and a model:

```json
{ "transactionId": "…", "offers": ["offer-churn-full", "offer-churn-logreg"] }
```

Grab the transaction id into a variable (we'll reuse it):

```bash
TXN=$(curl -s -X POST http://localhost:3001/search \
  -H 'content-type: application/json' \
  -d '{"intent":{"query":"churn"}}' | jq -r .transactionId)
```

> *If search came back empty,* the signed hops failed — usually the keys weren't loaded. Re-run the
> `source` commands from Step 1 and `docker compose ... up -d` again.

## Step 4 — Confirm, and look inside a real Access Grant

Now confirm the transaction for the full churn dataset. Behind this one request, the buyer app runs
`select`/`init`/`confirm` with the chosen provider and then asks the **Access Manager** to sign a grant
([Module 7](./07_our_system.md)):

```bash
curl -s -X POST http://localhost:3001/confirm \
  -H 'content-type: application/json' \
  -d "{\"transactionId\":\"$TXN\",\"bppId\":\"bpp.tabular.local\",\"offerId\":\"offer-churn-full\",\"resourceId\":\"ds-churn\",\"grantee\":{\"id\":\"agent-cli\"},\"purpose\":\"train a churn model\",\"licenseClass\":\"permissive\"}" \
  > confirm.json

# Look at the permission slip you just received:
jq '.grant.claims' confirm.json
```

There it is — the **Access Grant claims**, the six questions from [Module 5](./05_data_and_consent.md)
made concrete:

```json
{
  "grantId": "76e3faef-0bcc-4370-b414-09025c9e8fe6",
  "grantee": { "id": "agent-cli" },                 // WHO
  "resource": { "resourceId": "ds-churn",           // WHAT
                "offerId": "offer-churn-full" },
  "scope": { "kind": "full" },                       // HOW MUCH
  "purpose": "train a churn model",                  // WHY
  "expiresAt": 1783539318,                            // UNTIL WHEN
  "revocable": true                                   // REVOCABLE
  // …plus issuer, licenseClass, nonce, timestamps
}
```

And the part that makes it unforgeable — the signature ([Module 6](./06_cryptography.md)):

```bash
jq -r '.grant.signature' confirm.json    # a 128-character Ed25519 signature
```

Change one character of the claims and this signature would no longer verify — that's tamper-evidence you
can reason about, not take on faith.

## Step 5 — Download the data (HTTP 200)

To download, you present the grant to the provider. The grant travels in a request header, encoded as
one compact string. Encode it, then ask the provider for the file:

```bash
# 1. pull just the grant out, and encode it the way the provider expects:
jq -c .grant confirm.json > grant.json
ENC=$(python3 -c 'import base64; print(base64.urlsafe_b64encode(open("grant.json","rb").read()).decode().rstrip("="))')

# 2. download, presenting the grant:
curl -s -o churn.csv -w 'HTTP %{http_code}, %{size_download} bytes\n' \
  "http://localhost:3002/download?resourceId=ds-churn&offerId=offer-churn-full" \
  -H "Authorization: Grant $ENC"
```

You'll see:

```
HTTP 200, 104042 bytes
```

Real data, on your disk. Look at it:

```bash
head -3 churn.csv
# customer_id,age,tenure_months,monthly_charges,contract,churn
# cust-0,26,55,74.06,one-year,0
# cust-1,59,42,116.33,month-to-month,1
```

Behind that **200**, the provider ran the two-part check from [Module 6](./06_cryptography.md): **offline**
(signature valid? within the time window? right provider, resource, scope?) and **online** (is this
grant's id on the revoked list?). All passed, so it served the bytes.

## Step 6 — Revoke, then watch the same download get refused

Now the moment the whole course was built for. Withdraw consent at the **Access Manager** — the
independent authority ([Module 5](./05_data_and_consent.md)) — using the grant's id:

```bash
GID=$(jq -r .grant.claims.grantId confirm.json)

curl -s -X POST "http://localhost:3003/grants/$GID/revoke" \
  -H 'content-type: application/json' \
  -d '{"reason":"changed my mind"}' | jq
# → {"grantId":"…","status":"REVOKED","outcome":"revoked"}
```

Try the **exact same download again** — same grant, same command, nothing about the signed slip has
changed:

```bash
curl -s -o denied.json -w 'HTTP %{http_code}\n' \
  "http://localhost:3002/download?resourceId=ds-churn&offerId=offer-churn-full" \
  -H "Authorization: Grant $ENC"
cat denied.json
```

```
HTTP 403
{"error":"revoked"}
```

**Stop and appreciate this.** The grant's signature is still perfectly valid. Its expiry hasn't passed.
By every *offline* measure it's a good grant. And yet the provider refuses — because consent was
**withdrawn at the independent authority**, and the provider checks that authority (the shared revoked
list) on *every* download. This is the thing a download link can never do
([Module 10](./10_why_better.md)), happening on your own machine.

That single flip from **200** to **403** is Beckn Data Commons in one breath.

## Step 7 (optional but the coolest) — let an AI agent do all of it

Everything above, you did by hand with `curl`. The real point of the project
([Module 9](./09_mcp_and_agents.md)) is that an **AI agent** does it for you, in plain English, via MCP.

Follow [`docs/mcp-setup.md`](../docs/mcp-setup.md) to register the MCP server with Claude (Desktop or
Code). Then, with the network still running, just say:

> *"Find me a permissively-licensed churn dataset with at least 2,000 rows, get me the data, then
> revoke the access."*

Claude will call `search_resources` → `view_resource` → `confirm_access` (obtaining a signed grant) →
`download` (writing the CSV to disk) → `revoke_grant` — the entire flow you just did by hand, chosen and
executed by the agent, with **zero commands typed by you**. Watching the machine do Steps 3–6 on its own
initiative is the whole thesis in motion.

## Clean up

When you're done, shut the network down:

```bash
docker compose -f infra/docker-compose.yml down
```

(Your keys stay in the `infra/*.env` files if you want to run it again; delete them if you don't.)

## What you just proved

You booted an **open network** of independent services, watched **signed** messages flow across it,
received a **scoped, signed, revocable consent artifact** instead of a download link, used it to get real
data, and then **revoked it and watched access die instantly** — and optionally had an **AI agent** drive
the whole thing in a sentence. Every idea in this course, from [platforms vs. protocols](./02_platforms_vs_protocols.md)
to [DPI](./03_dpi.md) to [consent](./05_data_and_consent.md) to [cryptography](./06_cryptography.md) to
[agents](./09_mcp_and_agents.md), was on your screen.

You can now explain, to anyone, *why gating data access with a signed revocable grant on an open protocol
is better than a download link* — and you've seen it work.

## Where this lives in the project

- The commands here mirror the setup in [`docs/mcp-setup.md`](../docs/mcp-setup.md) and the wiring in
  [`infra/docker-compose.yml`](../infra/docker-compose.yml).
- The behavior you triggered is the whole system: [`docs/01_architecture.md`](../docs/01_architecture.md)
  is the technical overview, now fully within your reach.

## Check your understanding

1. In Step 6 the download returns **403** even though the grant's signature is valid and it hasn't
   expired. Which check produced the 403, and why couldn't the offline checks catch it?
2. Why did you have to `source` the key files before `docker compose up`?
3. What is the single most important difference between what you saw in Step 6 and how a normal download
   link behaves?

<details>
<summary>Answers</summary>

1. The **online revocation check** (the provider looking up the grant's id on the shared revoked list).
   The offline checks (signature, expiry, provider/resource/scope) can't catch it because revocation
   happens *after* signing and isn't part of the signed bytes.
2. The services refuse to run without their signing keys and the trusted-key registry (there's no
   unauthenticated mode); sourcing the files puts those values in the environment Docker reads.
3. A revoked grant is **refused immediately** by every provider; a download link keeps working until it
   expires, with no way to withdraw access after it leaks.

</details>

**That's the course.** Head back to the [start](./README.md), or open the technical
[`docs/`](../docs/01_architecture.md) — you're ready for them now. Terms you met along the way live in the
[Glossary](./GLOSSARY.md).
