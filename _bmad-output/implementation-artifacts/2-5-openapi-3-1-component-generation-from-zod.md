---
baseline_commit: 8fc36899085931fe9fede21452867e685d00e43f
---

# Story 2.5: OpenAPI 3.1 component generation from Zod

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an integrator,
I want OpenAPI DocumentPayload components generated from schema package,
so that spec cannot drift from validation (FR-1, FR-16 partial, AD-1).

## Acceptance Criteria

1. **Given** `@asteasolutions/zod-to-openapi@8.5.0` (Zod v4-compatible; v7.x is Zod v3-only) wired under `packages/schema/src/openapi/`, **when** `@usetagih/schema` build runs, **then** it emits OpenAPI **3.1** `components.schemas` to `packages/schema/openapi/components.json` via `OpenApiGeneratorV31.generateComponents()` — **components only**, no API paths/routes/webhooks.
2. **Given** the generator registry, **when** components are produced, **then** `components.schemas` includes registered components for at minimum: `DocumentPayload` (discriminated union on `documentType`), `ApiErrorEnvelope`, `ApiErrorDetail`, `Money`, and `SchemaMetadata` — all sourced from existing Zod schemas in `packages/schema/src/` (no duplicate schema definitions).
3. **Given** `DocumentPayloadSchema` (`z.discriminatedUnion("documentType", [InvoicePayloadSchema, QuotationPayloadSchema, ReceiptPayloadSchema])`), **when** OpenAPI is generated, **then** the `DocumentPayload` component expresses the union (via `oneOf`/`anyOf` and/or `discriminator.propertyName: documentType` with mapping to invoice|quotation|receipt variants — accept whichever shape `@asteasolutions/zod-to-openapi@8.5.0` emits for Zod v4 discriminated unions).
4. **Given** `moneyAmountSchema` (`z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/)`), **when** `Money` component is generated, **then** the `amount` property carries a string `pattern` matching that canonical decimal-string rule (non-negative base-10, no exponent notation — FR-4 alignment).
5. **Given** `templateSchema` (`z.enum(["modern", "classic"])`) and `TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE`, **when** document payload variants and/or `SchemaMetadata` are generated, **then** template enums document **`modern` and `classic`** per document type (PRD §10.1 contract — list both even though classic Typst ships in Epic 5).
6. **Given** `ApiErrorEnvelopeSchema` / `ApiErrorDetailSchema` from Story 2.3, **when** components generate, **then** error envelope shape matches PRD §10.3 structure (`error.code`, `error.message`, `error.requestId`, `error.details[]` with path/code/message/optional expected/received).
7. **Given** `packages/schema/src/openapi/components.test.ts`, **when** `bun test packages/schema` runs, **then** structural assertions (not JSON snapshot) verify key component paths exist: `DocumentPayload`, `ApiErrorEnvelope`, `Money` amount pattern, and template enum values — tests call the same `generateOpenApiComponents()` export used by the build script (no committed snapshot file).
8. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0; build produces `packages/schema/openapi/components.json`.
9. **Out of scope (explicit boundaries):**
   - **Epic 3 / Story 3.8:** HTTP routes (`GET /v1/schemas`, `POST /v1/{documentType}/validate`, etc.) — not in this story.
   - **Epic 7 / Story 7.4:** full OpenAPI **document** assembly (`generateDocument`), `GET /v1/openapi.json` publishing, `@stoplight/spectral-cli` CI (`packages/schema/spectral.yaml`) — Story 7.4 merges these components with API paths.
   - **Story 2.6:** shared validation fixture corpus (≥20 failure cases) — optional cross-check only; 2.5 owns generator + structural tests.
   - **Do not** modify validation behavior, error codes, or version negotiation logic from Stories 2.1–2.4.

## Tasks / Subtasks

- [ ] Task 1 — Dependency + Zod extension bootstrap (AC: 1)
  - [ ] Add `@asteasolutions/zod-to-openapi@8.5.0` to `packages/schema/package.json` `dependencies` (exact pin `8.5.0`, not `^8.5.0` — reproducible with workspace `zod@^4.4.3`)
  - [ ] Create `src/openapi/extend-zod.ts` — call `extendZodWithOpenApi(z)` once (required for `.openapi()` / registry registration with named components)
- [ ] Task 2 — Registry + generator (AC: 1, 2, 3, 4, 5, 6)
  - [ ] Create `src/openapi/registry.ts` — `OpenAPIRegistry`, register schemas (see Dev Notes §Registry)
  - [ ] Create `src/openapi/generate.ts` — export `generateOpenApiComponents()` using `OpenApiGeneratorV31`; CLI entry writes `openapi/components.json`
- [ ] Task 3 — Build wiring + gitignore (AC: 1, 8)
  - [ ] Update `packages/schema/package.json` `build` script to run generator after `tsc`
  - [ ] Add `packages/schema/openapi/` to root `.gitignore` (generated artifact — drift caught by structural tests + CI build, not committed snapshots)
- [ ] Task 4 — Structural tests (AC: 7)
  - [ ] Create `src/openapi/components.test.ts` — assert component keys, Money pattern, template enums, envelope nesting
- [ ] Task 5 — Verification gate (AC: 8)
  - [ ] `bun test packages/schema`
  - [ ] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Generate **OpenAPI 3.1 component schemas** from the canonical Zod definitions in `@usetagih/schema` so API spec and runtime validation cannot drift (AD-1, FR-1). This story delivers **`components.schemas` only** — the building blocks Epic 7 assembles into the published full spec (FR-16).

### Scope boundary — components vs full spec (encode exactly)

| Layer | Story 2.5 (this) | Epic 7 Story 7.4 | Epic 3 |
| --- | --- | --- | --- |
| **Output** | `packages/schema/openapi/components.json` (`generateComponents()`) | Full `openapi.json` at `GET /v1/openapi.json` | REST route handlers |
| **Contains** | Reusable schemas: DocumentPayload union, error envelope, Money, metadata | All MVP paths + merges components + Spectral CI | Serves JSON from generated artifact |
| **FR coverage** | FR-1 (contract components), FR-16 **partial**, AD-1 | FR-16 **complete** | FR-11, FR-3 HTTP |

**FR-16 full spec** (published URL, all MVP endpoints, Spectral zero errors) is **explicitly deferred** to Story 7.4. **Do not** add route registrations, `info`, `servers`, or Spectral ruleset in 2.5.

### Zod v4 compatibility decision (board-ratified library + pin)

| Option | Verdict | Rationale |
| --- | --- | --- |
| **`@asteasolutions/zod-to-openapi@8.5.0`** | **SELECT** | Epics AC names this library; v8+ officially supports Zod v4 (`zod@^4.4.3` in workspace); provides `OpenApiGeneratorV31` for OpenAPI 3.1 component dialect (type arrays vs nullable). v7.3.4 is Zod v3-only. |
| **Zod 4 native `z.toJSONSchema()` only** | **REJECT for MVP** | Emits JSON Schema fragments, not OpenAPI 3.1 `components.schemas` packaging; no registry/discriminator/component naming without manual wrapper layer — duplicates what zod-to-openapi already solves. Would violate epics AC library choice without board re-ratification. |

**Pin exactly:** `"@asteasolutions/zod-to-openapi": "8.5.0"` in `packages/schema/package.json`.

**Bootstrap (required once per process):**

```typescript
// packages/schema/src/openapi/extend-zod.ts
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);
```

Import `./extend-zod.js` as the **first** import in `registry.ts` (side effect before any schema registration).

**Generator class:** `OpenApiGeneratorV31` — not `OpenApiGeneratorV3` (3.0 nullable dialect) or `OpenApiGeneratorV32` (3.2 — out of scope).

### Registry — schemas to register (implement exactly)

Create `packages/schema/src/openapi/registry.ts`:

```typescript
import "./extend-zod.js";

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { DocumentPayloadSchema } from "../document/document-payload";
import { InvoicePayloadSchema } from "../document/invoice-payload";
import { QuotationPayloadSchema } from "../document/quotation-payload";
import { ReceiptPayloadSchema } from "../document/receipt-payload";
import { MoneySchema } from "../document/money";
import { ApiErrorDetailSchema } from "../errors/detail";
import { ApiErrorEnvelopeSchema } from "../errors/envelope";
import { SchemaMetadataSchema } from "../version/metadata";

export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.register("DocumentPayload", DocumentPayloadSchema);
openApiRegistry.register("InvoicePayload", InvoicePayloadSchema);
openApiRegistry.register("QuotationPayload", QuotationPayloadSchema);
openApiRegistry.register("ReceiptPayload", ReceiptPayloadSchema);
openApiRegistry.register("ApiErrorEnvelope", ApiErrorEnvelopeSchema);
openApiRegistry.register("ApiErrorDetail", ApiErrorDetailSchema);
openApiRegistry.register("Money", MoneySchema);
openApiRegistry.register("SchemaMetadata", SchemaMetadataSchema);
```

**Rules:**

- Register **existing exported Zod schemas** — do **not** fork duplicate Zod objects in `openapi/`.
- Do **not** add `.openapi()` calls to `document/*.ts` or `errors/*.ts` source files — keep OpenAPI wiring isolated under `src/openapi/` via `registry.register(name, schema)`.
- Variant payload schemas registered explicitly so Epic 7 can `$ref` them individually if needed.

### Generator + build artifact (implement exactly)

**File:** `packages/schema/src/openapi/generate.ts`

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { openApiRegistry } from "./registry.js";

const MONEY_AMOUNT_PATTERN = "^(?:0|[1-9]\\d*)(?:\\.\\d+)?$";

export function generateOpenApiComponents(): Record<string, unknown> {
	const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);
	return generator.generateComponents() as Record<string, unknown>;
}

/** Exported for structural tests — same function build script uses. */
export { MONEY_AMOUNT_PATTERN };

async function writeComponentsArtifact(): Promise<void> {
	const components = generateOpenApiComponents();
	const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
	const outPath = join(packageRoot, "openapi/components.json");
	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, `${JSON.stringify(components, null, 2)}\n`, "utf8");
}

const isDirectExecution =
	import.meta.main ??
	process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
	await writeComponentsArtifact();
}
```

**Build wiring** — update `packages/schema/package.json`:

```json
{
  "scripts": {
    "build": "tsc --project tsconfig.build.json --outDir dist && bun run src/openapi/generate.ts",
    "generate:openapi": "bun run src/openapi/generate.ts"
  }
}
```

**Artifact path:** `packages/schema/openapi/components.json`

**Git policy:** **gitignored** — add `packages/schema/openapi/` to root `.gitignore`. Rationale: generated from Zod at build; structural tests assert invariants without brittle full-file snapshots; CI `build` task regenerates on every run.

**Turbo:** existing `build.outputs: ["dist/**"]` sufficient; optional follow-up to add `openapi/**` for cache — not required for AC.

### Structural test assertions (AC 7 — no snapshot file)

**File:** `packages/schema/src/openapi/components.test.ts`

Import `generateOpenApiComponents` and `MONEY_AMOUNT_PATTERN` from `./generate.js`.

Minimum assertions:

```typescript
const components = generateOpenApiComponents();
const schemas = (components as { schemas?: Record<string, unknown> }).schemas ?? {};

// DocumentPayload union present
expect(schemas).toHaveProperty("DocumentPayload");
const docPayload = schemas.DocumentPayload as Record<string, unknown>;
expect(
	docPayload.oneOf ?? docPayload.anyOf ?? docPayload.discriminator,
).toBeDefined();

// Discriminator mapping (if library emits it)
if (docPayload.discriminator) {
	const disc = docPayload.discriminator as { propertyName?: string; mapping?: Record<string, string> };
	expect(disc.propertyName).toBe("documentType");
	if (disc.mapping) {
		expect(Object.keys(disc.mapping)).toEqual(
			expect.arrayContaining(["invoice", "quotation", "receipt"]),
		);
	}
}

// Error envelope
expect(schemas).toHaveProperty("ApiErrorEnvelope");
expect(schemas).toHaveProperty("ApiErrorDetail");

// Money decimal pattern — walk nested properties for pattern match
function findPattern(obj: unknown, pattern: string): boolean {
	if (!obj || typeof obj !== "object") return false;
	const record = obj as Record<string, unknown>;
	if (record.pattern === pattern) return true;
	return Object.values(record).some((v) => findPattern(v, pattern));
}
expect(findPattern(schemas.Money, MONEY_AMOUNT_PATTERN)).toBe(true);

// Template enums modern|classic — check SchemaMetadata and/or payload template field
expect(schemas).toHaveProperty("SchemaMetadata");
const metaJson = JSON.stringify(schemas.SchemaMetadata);
expect(metaJson).toContain("modern");
expect(metaJson).toContain("classic");

// InvoicePayload template property enum (direct or $ref-resolved in serialized output)
const allSchemasJson = JSON.stringify(schemas);
expect(allSchemasJson).toMatch(/modern/);
expect(allSchemasJson).toMatch(/classic/);
```

Use helper functions as needed — **do not** commit a golden `components.json` snapshot.

### File layout (implement exactly)

```text
packages/schema/src/openapi/
├── extend-zod.ts          # extendZodWithOpenApi(z) — import first in registry
├── registry.ts            # OpenAPIRegistry + register() calls
├── generate.ts            # generateOpenApiComponents() + CLI write
└── components.test.ts     # structural assertions

packages/schema/openapi/
└── components.json          # GENERATED at build — gitignored

packages/schema/package.json # ADD dependency + build script (UPDATE)
.gitignore                   # ADD packages/schema/openapi/ (UPDATE)
```

**Do not** export OpenAPI generator from `src/index.ts` public package API (internal build concern). Epic 7 may import from `src/openapi/generate.ts` or read the artifact — document only; no public export required in 2.5.

### PRD / architecture alignment

| Ref | Requirement for 2.5 |
| --- | --- |
| **FR-1** | OpenAPI 3.1 publishes `DocumentPayload` discriminated union — **components** generated here; path reuse in Epic 7 |
| **FR-16** | Full published spec + Spectral CI — **partial** in 2.5 (components only); Story 7.4 completes |
| **AD-1** | Single canonical contract in `packages/schema`; OpenAPI derived from same Zod — no duplicate definitions |
| **PRD §10.1** | `template: "modern" \| "classic"`; monetary amounts as decimal strings |
| **SOLUTION-DESIGN §16** | Generate OpenAPI 3.1 from `@usetagih/schema` at build time — this story implements the schema-package half |

### Epic 2 cross-story boundaries

| Story | Owns | Not in 2.5 |
| --- | --- | --- |
| **2.1 (done)** | `DocumentPayloadSchema` discriminated union, primitives | — |
| **2.2 (done)** | Business rule validators | OpenAPI for findings |
| **2.3 (done)** | `ApiErrorEnvelopeSchema`, `ApiErrorDetailSchema` | — |
| **2.4 (done)** | `getSchemaMetadata()`, `TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE` | HTTP GET `/v1/schemas` |
| **2.5 (this)** | OpenAPI 3.1 component generation + structural tests | Full spec, routes, Spectral |
| **2.6** | ≥20 fixture pass/fail corpus | Generator logic |
| **7.4** | `GET /v1/openapi.json`, Spectral, all MVP paths | — |

### Previous story intelligence

| Source | Learning for 2.5 |
| --- | --- |
| Story 2.4 | `TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE` lists `modern` + `classic` per type — OpenAPI must match metadata, not Typst file availability |
| Story 2.4 | `SchemaMetadataSchema` strict shape — register for OpenAPI template enum documentation |
| Story 2.3 | Envelope/detail Zod schemas are `.strict()` — register as-is |
| Story 2.1 | `DocumentPayloadSchema` uses `z.discriminatedUnion("documentType", ...)` — expect OpenAPI union/discriminator output |
| Story 2.1 | `moneyAmountSchema` regex in `primitives.ts` — structural test must match exact pattern string |

### Git intelligence (recent Epic 2 work)

| Commit | Relevance |
| --- | --- |
| `8fc3689` | Story 2.4 done — current HEAD baseline |
| `42769ff` | feat: schema version negotiation — `SchemaMetadataSchema`, template constants |
| `e053d07` | Story 2.4 file pattern — comprehensive dev notes + validation section |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit | `8fc36899085931fe9fede21452867e685d00e43f` |
| Zod version | `^4.4.3` (workspace pin) |
| zod-to-openapi pin | `8.5.0` (Zod v4 + OpenApiGeneratorV31) |
| OpenAPI version | **3.1** (`OpenApiGeneratorV31`) |
| Artifact | `packages/schema/openapi/components.json` (gitignored) |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Unit tests | `bun test packages/schema` |
| Spectral CI | deferred Story 7.4 (`packages/schema/spectral.yaml` placeholder in ci.yml) |

### Anti-patterns (do not)

- Do not use `@asteasolutions/zod-to-openapi@7.x` — incompatible with Zod v4.
- Do not replace with raw `z.toJSONSchema()` unless build fails on discriminated union — then escalate, do not silently swap libraries.
- Do not register API paths/routes/webhooks in 2.5.
- Do not commit `components.json` or snapshot-test the full generated file.
- Do not duplicate Zod schema definitions under `openapi/` — import from existing modules.
- Do not scatter `.openapi()` calls across `document/` or `errors/` — isolate in `openapi/registry.ts`.
- Do not add Spectral ruleset or CI job changes (Story 7.4).
- Do not expand Story 2.6 fixture corpus in this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.5 ACs]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — FR-1, FR-16, §10.1, §10.3]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md` — §16 OpenAPI/SDK generation]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 7.4 full spec boundary]
- [Source: `_bmad-output/implementation-artifacts/2-4-schema-version-negotiation-helpers.md` — template metadata contract]
- [Source: `packages/schema/src/document/document-payload.ts` — discriminated union]
- [Source: `packages/schema/src/document/primitives.ts` — moneyAmountSchema, templateSchema]
- [Source: `packages/schema/src/errors/envelope.ts` — ApiErrorEnvelopeSchema]
- [Source: `packages/schema/src/version/metadata.ts` — SchemaMetadataSchema]
- [Source: `@asteasolutions/zod-to-openapi@8.5.0` README — OpenApiGeneratorV31, registry.register, generateComponents]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Story Validation

_Validated against create-story checklist (headless) on 2026-07-20._

| Check | Result |
| --- | --- |
| Epics Story 2.5 ACs fully encoded | PASS |
| FR-1 / FR-16 partial / AD-1 scope boundary explicit | PASS |
| Zod v4 compatibility — `@asteasolutions/zod-to-openapi@8.5.0` pinned with rationale vs native JSON Schema | PASS |
| Epic 7.4 / Epic 3 route scope excluded | PASS |
| File layout + registry + generator code shape specified | PASS |
| Build wiring + gitignored artifact decision documented | PASS |
| Structural test assertions (no snapshot brittleness) | PASS |
| Story 2.6 fixture scope excluded | PASS |
| Previous story 2.4 template/metadata contract referenced | PASS |
| Verification commands specified | PASS |
| Baseline commit hash verified | PASS |

## Change Log

- 2026-07-20: story context created for OpenAPI 3.1 component generation from Zod (Story 2.5)
