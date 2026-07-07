# Data Contract — Beckn v2.0.0 DDM (as captured)

Per the "external interfaces — inspect before integrating" rule, this is the **verified** field
contract for the Beckn messages our BAP/BPP will exchange, captured from real payloads — not
transcribed from spec prose.

## Provenance

| Item | Value |
| --- | --- |
| Protocol version | `2.0.0` (`context.version`) |
| Simulator | `fidedocker/sandbox-2.0:latest` — repo [`beckn/sandbox`](https://github.com/beckn/sandbox), default branch `main` |
| Domain / networkId | `nfh.global/testnet-ddm` (Decentralised Data Marketplace testnet) |
| Domain schema spec | [`beckn/DDM`](https://github.com/beckn/DDM) — `DatasetItem` v1/v1.1, `DatasetFulfillment` v1/v1.1 |
| Captured payloads | [`protocol-samples/ddm/`](./protocol-samples/ddm/) (`on_discover`, `on_select`, `on_init`, `on_confirm`) + one live async callback |
| Capture method | Ran the container locally, drove `discover`, recorded the sync ACK and the async callback POST |
| Auth / signing | **Not captured** (sandbox is unsigned). See `00_protocol.md` §4 — verify against real Fabric before implementing. |

## 1. `context` (every request and callback)

All keys are **camelCase**. Types are from captured values.

| Field | Type | Meaning / notes |
| --- | --- | --- |
| `networkId` | string | Network + domain, e.g. `nfh.global/testnet-ddm`. Selects the domain. Replaces v1 `domain`. |
| `action` | string | `discover` \| `select` \| `init` \| `confirm` on requests; `on_<action>` on callbacks. |
| `version` | string | `"2.0.0"`. |
| `bapId`, `bapUri` | string | Consumer platform id + base URL. **Callbacks are POSTed to `bapUri`.** |
| `bppId`, `bppUri` | string | Provider platform id + base URL. |
| `transactionId` | string (UUID) | Stable across the whole journey. BAP correlation key for aggregating multi-provider replies. |
| `messageId` | string (UUID) | One request/response pair. Echoed in ACK and callback. |
| `timestamp` | string (ISO-8601) | Refreshed by the responder on each hop. |
| `ttl` | string (ISO-8601 duration) | e.g. `PT30S`. Message validity window → basis for replay window + BAP aggregation timeout. |

**ACK shape** (synchronous response to any request): `{ "message": { "status": "ACK", "messageId": "<echoed>" } }`.

## 2. `on_discover` → `message.catalogs[]`

`message.catalogs` is an **array**. Each catalog:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Catalog id, e.g. `catalog-climate-rain-001`. |
| `descriptor` | object | `{ name, shortDesc, longDesc? }`. |
| `bppId`, `bppUri` | string | Owning provider platform (repeated from context at catalog scope). |
| `provider` | object | `{ id, descriptor: { name } }`. |
| `isActive` | boolean | Provider/catalog active flag. |
| `resources[]` | array | The datasets/models themselves: `{ id, descriptor: { name, shortDesc, longDesc } }`. |
| `offers[]` | array | Purchasable/accessible offers over resources — see below. |

Each **offer**:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Offer id. |
| `descriptor` | object | Human name/desc of the offer (e.g. "One-Time Bulk Download … valid for 7 days"). |
| `resourceIds[]` | string[] | Which `resources[].id` this offer covers. |
| `offerAttributes` | object | **JSON-LD `DatasetItem`** — the rich metadata (see §2.1). |
| `validity` | object | `{ startDate, endDate }` (ISO-8601) — offer availability window. |
| `considerations[]` | array | Pricing: `{ id, status:{code}, considerationAttributes: PriceSpecification }` with `currency`, `value`, `components[]` (UNIT/TAX). |

### 2.1 `offerAttributes` = `DatasetItem` (authoritative, from `beckn/DDM`)

`@type: "DatasetItem"`, `@context` → DDM `DatasetItem/v1(.1)`. Required: `schema:identifier`,
`schema:name`, `schema:temporalCoverage`. Mix of schema.org (`schema:`) and DDM ext (`dataset:`).

| Field | Type | Meaning |
| --- | --- | --- |
| `schema:identifier` / `schema:name` / `schema:description` | string | Dataset identity. |
| `schema:license` | string(URI) \| object | e.g. `https://creativecommons.org/licenses/by/4.0/`. |
| `schema:conditionsOfAccess` | string \| object | Free-text terms, e.g. "Attribution required; no resale of raw data." **Not enforceable** — see §4. |
| `schema:temporalCoverage` | string | e.g. `2025-03-01/2025-03-31`. |
| `schema:spatialCoverage` | string \| object | `schema:Place` w/ `schema:geo` bbox. |
| `schema:variableMeasured` | array | Measured variables. |
| `schema:temporalResolution` / `schema:spatialResolution` | string \| object | e.g. `P1D`; `{value:5, unitText:"km"}`. |
| `schema:creator` / `schema:isBasedOn` | object \| array | Provenance. |
| `dataset:accessMethod` | enum | `INLINE`\|`DOWNLOAD`\|`DATA_ENCLAVE`\|`OFF_CHANNEL`\|`MQTT`\|`KAFKA`\|`API`\|`DATA_LAKE`. |
| `dataset:rowCountEstimate` | integer | Row count. **Maps to our "≥ N rows" search filter.** |
| `dataset:columnCount` | integer | Column count. |
| `dataset:dataType` | string | e.g. `GriddedProbabilityField`. |
| `dataset:refreshType` / `dataset:granularity` | string | `STATIC`; `GRID_DAILY`. |
| `dataset:sensitivityLevel` | string | e.g. `PUBLIC`. |
| `dataset:qualityFlags` | object | `gapFilledPercent`, `outlierRemovedPercent`, `validationMethod`, … |
| `dataset:streamMeta` | object | Stream topology (format/frequency/schema URL) when accessMethod is a stream. |

## 3. Contract lifecycle: `on_select` / `on_init` / `on_confirm` → `message.contract`

The **`contract`** object is the spine and accretes across the flow:

| Callback | `contract.status` | Keys present | Fulfillment/access? |
| --- | --- | --- | --- |
| `on_select` | `DRAFT` | id, descriptor, participants, commitments, consideration, status | no |
| `on_init` | `ACTIVE` | (same set, firmed up) | no |
| `on_confirm` | `ACTIVE` | + **performance**, + **settlements** | **yes** |

Access appears **only at `on_confirm`**, in `contract.performance[].performanceAttributes` =
**`DatasetFulfillment`** (`@type: "DatasetFulfillment"`, `@context` → DDM `DatasetFulfillment/v1(.1)`).
Required: `fulfillment:accessMethod`. For `DOWNLOAD`:

| Field | Type | Meaning |
| --- | --- | --- |
| `fulfillment:accessMethod` | enum | `DOWNLOAD`\|`API`\|`STREAM`\|`MQTT`\|`KAFKA`\|`DATA_LAKE`\|`DATA_ROOM`\|`SFTP`. |
| `fulfillment:accessUrl` | string(URI) | "Signed or time-limited URL." Captured value embeds `?token=eyJhbGci…HS256…SIGNATURE`. **This is the bearer pattern we replace — see §4.** |
| `fulfillment:accessStart` / `fulfillment:accessEnd` | date-time | Access window. |
| `fulfillment:format` / `fulfillment:fileSizeBytes` | string / int | `Parquet`; size. |
| `fulfillment:maxDownloads` / `fulfillment:downloadsUsed` | int | Download cap + counter. |
| `fulfillment:termsUrl` / `fulfillment:attributionText` / `fulfillment:supportEmail` | string | Terms + attribution. |
| `fulfillment:streamConnection` | object | Short-lived stream creds (MQTT/Kafka/API/DataLake) with `credentialExpiresAt`, rotate via `update`. |

## 4. Mapping to BDC + where our Access Grant plugs in

- **Catalog/discovery:** map `@bdc/beckn-schemas` onto the official `DatasetItem`. Our
  `ResourceKind` (dataset/model) and `LicenseClass` (permissive/research-only/no-redistribution) are a
  coarse, enforceable-by-us abstraction over `schema:license` + `schema:conditionsOfAccess` +
  `dataset:sensitivityLevel`. Keep the `schema:`/`dataset:` fields on the wire for interop; carry our
  coarse enums alongside for grant scoping.
- **The gap we fill:** DDM access = `fulfillment:accessUrl` (a bearer URL + embedded opaque token +
  time window + download counter) or short-lived stream creds issued **directly by the data holder**.
  There is **no** separable consent manager, no scope/purpose binding, no third-party-verifiable
  signature, and no *revocation* (only expiry/rotation).
- **Our Access Grant** replaces the value of `fulfillment:accessUrl`'s trust model: at `confirm`, the
  **Access Manager** (separate from the BPP) issues an **Ed25519-signed, scoped, purpose-bound,
  expiring, revocable** grant. The BPP download endpoint verifies signature+scope+expiry **offline**
  and checks revocation **online** before serving bytes. We can still surface it through the standard
  `DatasetFulfillment` envelope (e.g. `accessUrl` points at our grant-gated endpoint; the grant itself
  travels as a signed token), so we remain wire-compatible while upgrading the security model.

## 5. Known quirks / gotchas

- **Casing drift:** the sandbox controller reads both `bppUri` and `bpp_uri`. Normalize context keys
  to camelCase on ingest; do not trust a single casing.
- **Async only:** results never come back on the request's HTTP response (that's just an ACK). Must
  have a callback endpoint + `transactionId` correlation + `ttl`-bounded aggregation window.
- **`catalogs` is plural/array**; `contract` is singular. Don't confuse resource (the dataset) with
  offer (how you get it) — access scoping attaches to the **offer**, and fulfillment to the contract.
- **Additional properties allowed:** both DDM schemas set `additionalProperties: true`. Parse
  defensively; validate the fields we depend on, pass through the rest.
- **Signing unverified here.** Do not implement `@bdc/crypto-utils` verification until a real signed
  Fabric request's `Authorization` header is captured.
