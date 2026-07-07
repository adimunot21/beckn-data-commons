# BDC Domain Schema

How Beckn Data Commons models datasets/models for discovery, and how that maps onto the official
Beckn DDM wire format. Schemas live in `packages/beckn-schemas/src/` and are validated against real
captured payloads in `wire.test.ts`.

## Principle: align on the wire, normalize internally

We do **not** invent a parallel catalog format. On the wire we speak the official DDM
`DatasetItem` / `DatasetFulfillment` schemas (`docs/data-contract.md`) so we interoperate with any DDM
participant. Internally we carry a small **normalized overlay** — the vocabulary we own — used for
search filtering and, critically, for scoping Access Grants. Overlay lives in `domain.ts`; wire
schemas in `catalog.ts` / `contract.ts`.

## The vocabulary we own (`domain.ts`)

| Type | Values | Purpose |
| --- | --- | --- |
| `ResourceKind` | `dataset` \| `model` | What the entry is. |
| `Modality` | `tabular`, `text`, `image`, `audio`, `timeseries`, `geospatial`, `multimodal` | Primary dataset filter. |
| `TaskType` | `classification`, `regression`, `forecasting`, `clustering`, `generation`, `detection`, `segmentation`, `recommendation`, `other` | ML task tag/filter. |
| `LicenseClass` | `permissive` \| `research-only` \| `no-redistribution` | Enforceable, coarse normalization of DDM's free-form license/terms. |
| `SearchIntent` | object (all optional) | Normalized target the MCP/NLU layer produces from natural language, before rendering a Beckn `discover`. |

`SearchIntent` fields: `kind`, `modality`, `taskType`, `licenseClass`, `query` (free text),
`minRows` (→ `dataset:rowCountEstimate`), `purpose` (carried into the grant). All optional so a
partial intent ("a tabular churn dataset") is valid.

## Mapping overlay ⇄ DDM `DatasetItem`

| BDC overlay | DDM `DatasetItem` source | Notes |
| --- | --- | --- |
| `ResourceKind` | `@type` / provider context | `DatasetItem` today implies dataset; models tagged via our own attribute + `@type` extension. |
| `Modality`, `TaskType` | `dataset:dataType`, `schema:variableMeasured`, descriptor text | DDM has no first-class modality/task; we classify at seed time and tag. |
| `LicenseClass` | `schema:license` (URL) + `schema:conditionsOfAccess` | e.g. CC-BY URL → `permissive`; "no resale of raw data" → `no-redistribution`. |
| `minRows` filter | `dataset:rowCountEstimate` | Numeric compare. |
| `SearchIntent.query` | descriptor `name`/`shortDesc`/`longDesc` | Text match. |

Because both DDM schemas set `additionalProperties: true`, all our Zod objects use `.passthrough()`:
we validate the fields we depend on and forward the rest untouched. If a real payload stops matching,
`wire.test.ts` fails and tells us to re-inspect (the inspect-before-integrating guard, encoded as a
test).

## Catalog structure (recap, from `catalog.ts`)

`on_discover.message.catalogs[]` → each catalog has `provider`, `resources[]` (the datasets/models),
and `offers[]`. An **offer** carries the `DatasetItem` metadata (`offerAttributes`), a `validity`
window, and `considerations[]` (pricing). **Access scoping attaches to the offer**; fulfillment
attaches to the contract at confirm.

## Where the grant plugs in

Discovery and contract negotiation stay pure DDM. At `on_confirm`, instead of trusting DDM's bare
`fulfillment:accessUrl`, the Access Manager issues a signed **Access Grant** scoped to
`{ resourceId, offerId, scope }` and the download endpoint enforces it. See
[`consent-artifact-spec.md`](./consent-artifact-spec.md).
