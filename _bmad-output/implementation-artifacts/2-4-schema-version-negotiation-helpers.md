---
baseline_commit: 955aff44131862623ed6a43f36150dc3d86f00ed
---

# Story 2.4: Schema version negotiation helpers

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an agent developer,
I want schemaVersion default `2026-07-20` with unsupported version rejection,
so that contract upgrades are explicit (FR-3, AD-12, NFR-10).

## Acceptance Criteria

1. **Given** `packages/schema/src/version/` is the single source of truth for schema version constants and metadata, **when** `@usetagih/schema` is built, **then** it exports `CURRENT_SCHEMA_VERSION`, `SUPPORTED_SCHEMA_VERSIONS`, `assertSupportedSchemaVersion()`, `normalizePayloadSchemaVersion()`, `getSchemaMetadata()`, and typed `SchemaMetadata` — no duplicate version literals elsewhere in the package.
2. **Given** a payload object omitting `schemaVersion`, **when** `normalizePayloadSchemaVersion(raw)` runs on a plain object, **then** it returns `{ ok: true, normalized }` where `normalized.schemaVersion === "2026-07-20"`; **and** when the normalized payload is parsed through `DocumentPayloadSchema`, **then** inferred output includes `schemaVersion: "2026-07-20"`.
3. **Given** a payload with `schemaVersion: "2026-07-20"`, **when** `assertSupportedSchemaVersion("2026-07-20")` runs, **then** it returns `{ ok: true, schemaVersion: "2026-07-20" }`; **and** `validateDocumentPayload(raw)` proceeds to structural/business stages unchanged from Story 2.2 behavior.
4. **Given** a payload with unknown `schemaVersion` (e.g. `"2025-01-01"` or non-string), **when** `assertSupportedSchemaVersion(value)` or `normalizePayloadSchemaVersion(raw)` runs, **then** it returns `{ ok: false, code: "UNSUPPORTED_SCHEMA_VERSION", message, received, supportedVersions }` where `message` includes the human-readable list of supported versions (e.g. `Supported versions: 2026-07-20`); **and** `getHttpStatusForErrorCode("UNSUPPORTED_SCHEMA_VERSION") === 400` (enum from Story 2.3 — **no new error codes in 2.4**).
5. **Given** `validateDocumentPayload(raw)` orchestration, **when** version negotiation fails, **then** result is `{ ok: false, stage: "schemaVersion", rejection: UnsupportedSchemaVersionResult }` — transport-agnostic; Epic 3 maps to HTTP 400 envelope via `buildApiErrorEnvelope({ code: UNSUPPORTED_SCHEMA_VERSION_CODE, message: rejection.message, ... })`.
6. **Given** `getSchemaMetadata()`, **when** called, **then** it returns `{ schemaVersion, supportedVersions, documentTypes, templates }` matching PRD FR-3 / GET `/v1/schemas` contract below; `documentTypes` sourced from `DOCUMENT_TYPES`; `templates` maps each document type to `["modern", "classic"]` (PRD §10.1 contract — **both templates listed even though classic Typst files ship in Epic 5**).
7. **Given** `SchemaMetadataSchema` (`.strict()`), **when** `getSchemaMetadata()` output is parsed, **then** parse succeeds; shape is stable for Story 3.8 endpoint and Story 7.3 SDK drift check.
8. **Given** `packages/schema/src/version/`, **when** `bun test packages/schema` runs, **then** tests cover: default applied on omit, known version passes, unknown version rejected with supported list in message, metadata shape, and `validateDocumentPayload` stage routing for version failure.
9. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
10. **Out of scope (Stories 2.5–2.6, Epic 3):** OpenAPI component generation for metadata (Story 2.5), HTTP route wiring for GET `/v1/schemas` (Story 3.8), envelope building inside version helpers (Epic 3.6), N/N-1 multi-version support beyond MVP single version (future AD-12 expansion), semver bump policy enforcement (Story 7.6).

## Tasks / Subtasks

- [x] Task 1 — Version constants module (AC: 1, 6)
  - [x] Create `version/constants.ts` with `CURRENT_SCHEMA_VERSION`, `SUPPORTED_SCHEMA_VERSIONS`, `SchemaVersion` type, `TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE`
  - [x] Derive `templateSchema` contract alignment — constants are authoritative for metadata; existing `primitives.ts` `templateSchema` stays `z.enum(["modern", "classic"])`
- [x] Task 2 — Version assertion + normalization (AC: 2, 3, 4, 5)
  - [x] Create `version/assert-schema-version.ts` with `assertSupportedSchemaVersion()` and `normalizePayloadSchemaVersion()`
  - [x] Update `validation/validate-document-payload.ts` — add `schemaVersion` stage before structural parse
  - [x] Update `document/base-document-payload.ts` — add `.default(CURRENT_SCHEMA_VERSION)` on `schemaVersion` field (import constant)
- [x] Task 3 — Metadata helper (AC: 6, 7)
  - [x] Export `Template` type from `document/primitives.ts` (`z.infer<typeof templateSchema>`)
  - [x] Create `version/metadata.ts` with `SchemaMetadataSchema`, `SchemaMetadata` type, `getSchemaMetadata()`
- [x] Task 4 — Public exports (AC: 1)
  - [x] Update `src/index.ts` — export version module surface
- [x] Task 5 — Tests (AC: 8)
  - [x] `version/assert-schema-version.test.ts` — default, pass, reject with supported list
  - [x] `version/metadata.test.ts` — shape, Zod round-trip, template map per type
  - [x] Extend or add orchestration test for `validateDocumentPayload` version stage
- [x] Task 6 — Verification gate (AC: 9)
  - [x] `bun test packages/schema`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Wire **schema version negotiation** in `@usetagih/schema`: default omitted `schemaVersion` to MVP version, reject unsupported versions with actionable message listing supported versions, and expose `getSchemaMetadata()` for GET `/v1/schemas` (implemented in Epic 3). Uses `UNSUPPORTED_SCHEMA_VERSION` from Story 2.3 — **no new enum entries**.

### PRD FR-3 / AD-12 / NFR-10 — authoritative semantics

| Ref | Requirement for this story |
| --- | --- |
| **FR-3** | Optional `schemaVersion` on payload; server defaults to current MVP version; unknown → 400 with supported list; GET `/v1/schemas` returns version, types, templates |
| **AD-12** | `GET /v1/schemas` is authority; MVP supports single version `2026-07-20` (N/N-1 policy applies when second version ships) |
| **NFR-10** | Breaking changes require new version string + 90d deprecation — constants module is the extension point |
| **PRD §10.1** | `schemaVersion?: "2026-07-20"` on `BaseDocumentPayload`; `template: "modern" \| "classic"` |

**Where `schemaVersion` lives today (Story 2.1):**

```typescript
// packages/schema/src/document/base-document-payload.ts
schemaVersion: schemaVersionSchema.optional(), // schemaVersionSchema = z.literal("2026-07-20")
```

Story 2.4 adds defaulting + pre-parse negotiation; does **not** move the field or change its JSON Pointer (`/schemaVersion`).

### Rejection result shape — decision (encode exactly)

**Pattern:** finding-style like `checkDocumentTypeMismatch` (Story 2.1) — **not** envelope-ready. Schema stays transport-agnostic; Epic 3 calls `buildApiErrorEnvelope`.

```typescript
import type { ErrorCode } from "../errors/codes";
import { UNSUPPORTED_SCHEMA_VERSION_CODE } from "../errors/codes";
import type { SchemaVersion } from "./constants";

export type UnsupportedSchemaVersionResult = {
  ok: false;
  code: typeof UNSUPPORTED_SCHEMA_VERSION_CODE;
  message: string;
  received: string;
  supportedVersions: readonly SchemaVersion[];
};

export type SchemaVersionAssertResult =
  | { ok: true; schemaVersion: SchemaVersion }
  | UnsupportedSchemaVersionResult;

export function assertSupportedSchemaVersion(
  value: unknown,
): SchemaVersionAssertResult;

export type NormalizeSchemaVersionResult =
  | { ok: true; normalized: Record<string, unknown> }
  | UnsupportedSchemaVersionResult;

export function normalizePayloadSchemaVersion(
  raw: unknown,
): NormalizeSchemaVersionResult;
```

**Message format (implement exactly):**

```typescript
function formatUnsupportedSchemaVersionMessage(
  received: string,
  supportedVersions: readonly SchemaVersion[],
): string {
  return `Unsupported schemaVersion "${received}". Supported versions: ${supportedVersions.join(", ")}`;
}
```

**`received` coercion:** non-string values → `String(value)` (e.g. `123` → `"123"`, `null` → `"null"`).

**Epic 3 seam (document only — implement in 3.6/3.8):**

```typescript
const versionResult = normalizePayloadSchemaVersion(rawBody);
if (!versionResult.ok) {
  return c.json(
    buildApiErrorEnvelope({
      code: versionResult.code,
      message: versionResult.message,
      requestId,
    }),
    getHttpStatusForErrorCode(versionResult.code),
  );
}
// continue with versionResult.normalized
```

No `details[]` entry required for version rejection (top-level message carries supported list per FR-3).

### Defaulting mechanism — decision (encode exactly)

**Two-layer approach** — pre-parse normalization **and** Zod default:

| Layer | Mechanism | Why |
| --- | --- | --- |
| **Pre-parse** | `normalizePayloadSchemaVersion()` injects `schemaVersion: CURRENT_SCHEMA_VERSION` when field absent on plain object | Enables `assertSupportedSchemaVersion` rejection **before** Zod turns unknown literal into generic `invalid_literal` ZodError |
| **Zod schema** | Change `baseDocumentPayloadShape.schemaVersion` to `schemaVersionSchema.default(CURRENT_SCHEMA_VERSION)` | Direct `DocumentPayloadSchema.parse()` callers (SDK `validateLocally`, tests) get default without duplicating normalization logic |

**Pre-parse rules (`normalizePayloadSchemaVersion`):**

1. If `raw` is not a plain object (`null`, array, primitive) → return `{ ok: true, normalized: raw }` unchanged so `validateDocumentPayload` falls through to structural Zod error (do **not** invent version errors for non-objects).
2. If `schemaVersion` key absent or `undefined` → shallow-clone object, set `schemaVersion: CURRENT_SCHEMA_VERSION`, return `{ ok: true, normalized }`.
3. If `schemaVersion` present → call `assertSupportedSchemaVersion(raw.schemaVersion)`; on success shallow-clone with canonical version string; on failure return rejection.

**Do not** use `.preprocess()` on the full `DocumentPayloadSchema` union — keeps version logic in dedicated module and preserves Story 2.1 discriminated-union structure.

### `getSchemaMetadata()` — exact return type

**PRD FR-3 + Story 3.8 AC:** returns current version, document types, template enums per type.

```typescript
import type { z } from "zod";
import type { DocumentType } from "../document/document-type";
import { DocumentTypeSchema } from "../document/document-type";
import { schemaVersionSchema, templateSchema } from "../document/primitives";
import type { SchemaVersion } from "./constants";

export type Template = z.infer<typeof templateSchema>; // export from primitives.ts in Task 3

export type SchemaMetadata = {
  schemaVersion: SchemaVersion;
  supportedVersions: readonly SchemaVersion[];
  documentTypes: readonly DocumentType[];
  templates: Record<DocumentType, readonly Template[]>;
};

export const SchemaMetadataSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    supportedVersions: z.array(schemaVersionSchema).min(1),
    documentTypes: z.array(DocumentTypeSchema).min(1),
    templates: z
      .object({
        invoice: z.array(templateSchema).min(1),
        quotation: z.array(templateSchema).min(1),
        receipt: z.array(templateSchema).min(1),
      })
      .strict(),
  })
  .strict();

export function getSchemaMetadata(): SchemaMetadata;
```

**MVP instance (hard-coded from constants — implement exactly):**

```json
{
  "schemaVersion": "2026-07-20",
  "supportedVersions": ["2026-07-20"],
  "documentTypes": ["invoice", "quotation", "receipt"],
  "templates": {
    "invoice": ["modern", "classic"],
    "quotation": ["modern", "classic"],
    "receipt": ["modern", "classic"]
  }
}
```

**Template metadata decision:** List **PRD contract set** (`modern` + `classic` per type), not merely implemented Typst files. Epic 1 shipped `modern` only; Epic 5 adds `classic`. OpenAPI (Story 2.5) documents the same enum from these constants.

### Metadata / template source of truth

**Single module:** `packages/schema/src/version/constants.ts`

```typescript
export const CURRENT_SCHEMA_VERSION = "2026-07-20" as const;

export const SUPPORTED_SCHEMA_VERSIONS = [
  CURRENT_SCHEMA_VERSION,
] as const;

export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export const TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE = {
  invoice: ["modern", "classic"],
  quotation: ["modern", "classic"],
  receipt: ["modern", "classic"],
} as const satisfies Record<
  DocumentType,
  readonly ["modern", "classic"]
>;
```

`getSchemaMetadata()` reads `DOCUMENT_TYPES` from `document/document-type.ts` and `TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE` from constants — **no hard-coded duplicates** in metadata.ts.

When second schema version ships (post-MVP), extend `SUPPORTED_SCHEMA_VERSIONS` array only in constants — metadata and assertion derive from it.

### File layout (implement exactly)

```text
packages/schema/src/version/
├── constants.ts                    # CURRENT_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS, TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE
├── assert-schema-version.ts        # assertSupportedSchemaVersion, normalizePayloadSchemaVersion, result types
├── assert-schema-version.test.ts
├── metadata.ts                     # SchemaMetadataSchema, getSchemaMetadata()
└── metadata.test.ts

packages/schema/src/validation/
└── validate-document-payload.ts    # ADD schemaVersion stage (UPDATE)

packages/schema/src/document/
└── base-document-payload.ts        # ADD .default(CURRENT_SCHEMA_VERSION) on schemaVersion (UPDATE)
```

Do **not** create `src/openapi/` (Story 2.5). Do **not** add entries to `errors/codes.ts` (Story 2.3 owns enum).

### Orchestrator update (`validate-document-payload.ts`)

Extend result union:

```typescript
export type ValidateDocumentPayloadResult =
  | { ok: true; data: DocumentPayload }
  | { ok: false; stage: "schemaVersion"; rejection: UnsupportedSchemaVersionResult }
  | { ok: false; stage: "structural"; error: z.ZodError }
  | { ok: false; stage: "business"; findings: BusinessRuleFinding[] };
```

**Pipeline order:**

1. `normalizePayloadSchemaVersion(raw)` — if `!ok` → return `{ ok: false, stage: "schemaVersion", rejection }`
2. `DocumentPayloadSchema.safeParse(normalized)` — structural (existing)
3. `validateDocumentPayloadArithmetic(data)` — business (existing)

### Test fixtures and cases

**Default applied (AC 2):**

```typescript
const raw = { /* valid invoice minimal fields, no schemaVersion */ };
const norm = normalizePayloadSchemaVersion(raw);
expect(norm.ok).toBe(true);
expect(norm.normalized.schemaVersion).toBe("2026-07-20");
const parsed = DocumentPayloadSchema.parse(norm.normalized);
expect(parsed.schemaVersion).toBe("2026-07-20");
```

**Known version passes (AC 3):**

```typescript
expect(assertSupportedSchemaVersion("2026-07-20")).toEqual({
  ok: true,
  schemaVersion: "2026-07-20",
});
```

**Unknown rejected with supported list (AC 4):**

```typescript
const result = assertSupportedSchemaVersion("2025-01-01");
expect(result.ok).toBe(false);
expect(result.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
expect(result.message).toContain("2025-01-01");
expect(result.message).toContain("Supported versions: 2026-07-20");
expect(result.supportedVersions).toEqual(["2026-07-20"]);
expect(getHttpStatusForErrorCode(result.code)).toBe(400);
```

**Metadata shape (AC 6–7):**

```typescript
const meta = getSchemaMetadata();
expect(SchemaMetadataSchema.parse(meta)).toEqual(meta);
expect(meta.templates.invoice).toEqual(["modern", "classic"]);
expect(meta.documentTypes).toEqual(["invoice", "quotation", "receipt"]);
```

**Orchestrator routing:**

```typescript
const result = validateDocumentPayload({ schemaVersion: "2099-01-01", /* ...minimal valid shape not required — fails at version stage */ });
expect(result.ok).toBe(false);
if (!result.ok) expect(result.stage).toBe("schemaVersion");
```

Use existing `__fixtures__/valid/invoice-minimal.json` — strip/add `schemaVersion` as needed.

### Epic 2 cross-story boundaries

| Story | Owns | Not in 2.4 |
| --- | --- | --- |
| **2.1 (done)** | Structural Zod, optional `schemaVersion` field | — |
| **2.2 (done)** | Arithmetic validators | — |
| **2.3 (done)** | `UNSUPPORTED_SCHEMA_VERSION` enum + HTTP 400 map | — |
| **2.4 (this)** | Default injection, version assertion, metadata helper | — |
| 2.5 | OpenAPI generation referencing metadata types | HTTP/OpenAPI files |
| 2.6 | ≥20 failure fixtures | Version fixtures optional |
| 3.8 | GET `/v1/schemas` route returning `getSchemaMetadata()` JSON | HTTP wiring |

### Public exports (`src/index.ts`)

Add (minimum):

- `CURRENT_SCHEMA_VERSION`, `SUPPORTED_SCHEMA_VERSIONS`, `SchemaVersion`
- `TEMPLATE_OPTIONS_BY_DOCUMENT_TYPE`
- `assertSupportedSchemaVersion`, `normalizePayloadSchemaVersion`
- `UnsupportedSchemaVersionResult`, `SchemaVersionAssertResult`, `NormalizeSchemaVersionResult`
- `getSchemaMetadata`, `SchemaMetadata`, `SchemaMetadataSchema`

Keep all existing document/validation/errors exports unchanged.

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit | `955aff44131862623ed6a43f36150dc3d86f00ed` (HEAD after Story 2.3 done + agents.md) |
| Zod version | `^4.4.3` |
| Current schemaVersion literal | `"2026-07-20"` in `primitives.ts` |
| Supported versions (MVP) | `["2026-07-20"]` only |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Unit tests | `bun test packages/schema` |
| No new dependencies | Zod only |

### Anti-patterns (do not)

- Do not add new error codes or modify `errors/codes.ts` beyond importing constants.
- Do not build HTTP responses or call `buildApiErrorEnvelope` inside version helpers.
- Do not create OpenAPI generator files (Story 2.5).
- Do not list only `modern` in metadata because classic Typst is not shipped yet — PRD contract is authoritative.
- Do not use `z.preprocess` on the discriminated union for version defaulting.
- Do not use `.passthrough()` on metadata schema.
- Do not duplicate `CURRENT_SCHEMA_VERSION` string outside `version/constants.ts`.

### Previous story intelligence

| Source | Learning for 2.4 |
| --- | --- |
| Story 2.3 | `UNSUPPORTED_SCHEMA_VERSION` already in enum + HTTP 400; import `UNSUPPORTED_SCHEMA_VERSION_CODE` — no new enum |
| Story 2.3 | Rejection helpers stay transport-agnostic; Epic 3 maps to envelope |
| Story 2.1 | `schemaVersion` optional with `z.literal("2026-07-20")`; `.strict()` on all objects — add `.default()` not `.optional()` alone |
| Story 2.1 | `checkDocumentTypeMismatch` result pattern — mirror for version rejection |
| Story 2.2 | `validateDocumentPayload` orchestrator — add stage before structural, preserve existing stages |

### Git intelligence (recent Epic 2 work)

| Commit | Relevance |
| --- | --- |
| `955aff4` | docs: enhance agents.md — current HEAD |
| `96bb0fa` | Story 2.3 marked done after code review |
| `06a82a9` | feat: error codes enum + envelope — `UNSUPPORTED_SCHEMA_VERSION` available |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.4 ACs]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — FR-3, NFR-10, §10.1 BaseDocumentPayload, §10.2 GET `/v1/schemas`]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1, AD-12]
- [Source: `_bmad-output/implementation-artifacts/2-3-error-codes-enum-and-api-error-envelope-types.md` — UNSUPPORTED_SCHEMA_VERSION seam]
- [Source: `_bmad-output/implementation-artifacts/2-1-document-payload-zod-discriminated-union.md` — schemaVersion optional, strictness]
- [Source: `packages/schema/src/document/base-document-payload.ts` — field to default]
- [Source: `packages/schema/src/document/primitives.ts` — schemaVersionSchema, templateSchema]
- [Source: `packages/schema/src/validation/validate-document-payload.ts` — orchestrator to extend]

## Dev Agent Record

### Agent Model Used

Composer 2.5 Fast

### Debug Log References

### Completion Notes List

- added `version/` module with constants, assert/normalize helpers, and `getSchemaMetadata()` sourced from single constants module
- two-layer defaulting: pre-parse `normalizePayloadSchemaVersion()` plus Zod `.default(CURRENT_SCHEMA_VERSION)` on base payload shape
- `validateDocumentPayload` routes unsupported versions to `stage: "schemaVersion"` before structural/business stages
- `schemaVersionSchema` in primitives now derives literal from `CURRENT_SCHEMA_VERSION` — no duplicate version strings
- verification: `bun test packages/schema` — 44 pass; `bunx turbo run lint typecheck test build --force` — 36/36 tasks green

### File List

- packages/schema/src/version/constants.ts (new)
- packages/schema/src/version/assert-schema-version.ts (new)
- packages/schema/src/version/assert-schema-version.test.ts (new)
- packages/schema/src/version/metadata.ts (new)
- packages/schema/src/version/metadata.test.ts (new)
- packages/schema/src/document/base-document-payload.ts (modified)
- packages/schema/src/document/primitives.ts (modified)
- packages/schema/src/validation/validate-document-payload.ts (modified)
- packages/schema/src/validation/validate-document-payload.test.ts (new)
- packages/schema/src/index.ts (modified)

## Story Validation

_Validated against create-story checklist (headless) on 2026-07-20._

| Check | Result |
| --- | --- |
| PRD FR-3 / AD-12 / NFR-10 semantics encoded | PASS |
| Story 2.3 enum reuse (no new codes) | PASS |
| Defaulting mechanism explicit (pre-parse + Zod `.default()`) | PASS |
| Rejection result shape (finding-style, transport-agnostic) | PASS |
| Metadata contract set includes classic (PRD authoritative) | PASS |
| File layout + function signatures + tests per AC | PASS |
| Epic 2.5 / 3.8 scope boundaries | PASS |
| Baseline commit hash verified | PASS |

## Change Log

- 2026-07-20: story context created for schema version negotiation helpers (Story 2.4)
- 2026-07-20: validation pass — fixed baseline hash, Template type export task, non-object normalize behavior
- 2026-07-20: implemented schema version negotiation helpers — default injection, unsupported rejection, metadata export, orchestrator stage
