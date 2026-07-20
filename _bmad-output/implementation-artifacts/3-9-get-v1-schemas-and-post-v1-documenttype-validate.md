---
baseline_commit: e4326b0
created: 2026-07-20
---

# Story 3.9: GET /v1/schemas and POST /v1/{documentType}/validate

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an integrator,
I want schema discovery and validate-only endpoint,
so that I can fix payloads before render (FR-3, FR-11, UJ-2).

## Acceptance Criteria

1. **Given** `GET /v1/schemas`, **when** called **without** `Authorization` or session cookie, **then** HTTP **200** with JSON body equal to `getSchemaMetadata()` output: `{ schemaVersion: "2026-07-20", supportedVersions: ["2026-07-20"], documentTypes: ["invoice","quotation","receipt"], templates: { invoice: ["modern","classic"], quotation: ["modern","classic"], receipt: ["modern","classic"] } }` — flat success body, **not** envelope-wrapped.
2. **Given** `GET /v1/schemas`, **when** called with valid Bearer session token or API key (optional auth), **then** same **200** body as AC 1 — auth must **not** change response shape or require workspace.
3. **Given** `POST /v1/invoices/validate`, `POST /v1/quotations/validate`, or `POST /v1/receipts/validate` with `Authorization: Bearer` and `renders:write` scope, **when** body is valid JSON matching path document type, **then** HTTP **200** with `{ valid: true, normalizedPreview: <DocumentPayload> }` where `normalizedPreview` is the **parsed** payload from `validateUseCase` (includes defaulted `schemaVersion: "2026-07-20"` when omitted).
4. **Given** valid authenticated validate request, **when** `validateUseCase` returns failure with `code: "VALIDATION_FAILED"` or business codes (`LINE_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`), **then** HTTP **422** AD-11 envelope via `respondApiError` / `buildApiErrorEnvelope` with `error.code`, `error.message` (use primary detail message or `"Validation failed"`), `error.requestId`, and `error.details[]` populated from use-case `details` — **no** `{ valid: false }` wrapper on error responses.
5. **Given** path `POST /v1/invoices/validate` with body `documentType: "quotation"`, **when** `validateUseCase` runs, **then** HTTP **400** with code `DOCUMENT_TYPE_MISMATCH`, message from mismatch helper, full AD-11 envelope including `requestId` and `details` with path `/documentType`.
6. **Given** payload with unsupported `schemaVersion` (e.g. `"2099-01-01"`), **when** validate runs, **then** HTTP **400** with code `UNSUPPORTED_SCHEMA_VERSION`, message includes supported versions list, `details` with path `/schemaVersion` — mapped from `validateUseCase` failure, **not** 422.
7. **Given** unknown path segment (e.g. `POST /v1/purchase-orders/validate`), **when** requested, **then** HTTP **404** `NOT_FOUND` via existing `/v1` catch-all — route registered only for `invoices|quotations|receipts`.
8. **Given** validate route without auth or with insufficient scope, **when** called, **then** HTTP **401** `UNAUTHORIZED` or **403** `FORBIDDEN` per existing auth/scope guards — same behavior as render stub routes.
9. **Given** route handler implementation, **when** inspected, **then** handler calls `validateUseCase({ pathDocumentType, rawPayload })` from `@usetagih/core` only — **no** direct `validateDocumentPayload` / duplicate staging in `apps/api`; path plural → singular mapping reuses shared constant (see Dev Notes).
10. **Given** `packages/schema/src/auth/scopes.ts` `ROUTE_SCOPE_REQUIREMENTS`, **when** updated, **then** includes `POST /v1/invoices/validate`, `POST /v1/quotations/validate`, `POST /v1/receipts/validate` → `["renders:write"]`; scope-parity tests extended (session.token.test.ts pattern).
11. **Given** `bun test apps/api`, **when** validate + schemas tests run, **then** unit tests cover: schemas 200 unauthenticated; validate 200 happy path per type using `packages/schema/__fixtures__/valid/*-minimal.json`; validate 422 structural failure; validate 400 document-type mismatch; validate 400 unsupported schemaVersion; auth/scope denial on validate.
12. **Given** compose Postgres available, **when** `apps/api/src/integration/validate.integration.test.ts` runs (postgres-gated via existing `probeDb()` pattern), **then** end-to-end flow: sign-up → session token or API key → validate valid invoice fixture → 200 + `normalizedPreview.documentType === "invoice"`; repeat for quotation and receipt minimal fixtures.
13. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
14. **Out of scope (later Epic 3 stories):** audit event on validate (Story 3.15); preview route (Story 3.11); render pipeline calling validate internally (Story 3.12); SDK `validateLocally` (Story 7.1); OpenAPI Spectral completeness (Story 7.4); rate limits / quota (Story 3.16); idempotency on validate; changing render stub routes beyond optionally invoking validate in Story 3.12.

## Tasks / Subtasks

- [x] Task 1 — Shared document-type path constants (AC: 7, 9)
  - [x] Create `apps/api/src/lib/document-type-paths.ts` — export `DOCUMENT_TYPE_PATHS`, `pathSegmentToDocumentType()`, `documentTypeToPathSegment()` mirroring render stub mapping (`invoices` → `invoice`, etc.)
  - [x] Refactor `render-by-document-type.stub.ts` to import shared constants (DRY — optional but recommended)
  - [x] Unit tests in `document-type-paths.test.ts`
- [x] Task 2 — GET /v1/schemas route (AC: 1, 2)
  - [x] Create `apps/api/src/routes/v1/schemas.ts` — `GET /schemas` handler returns `getSchemaMetadata()` from `@usetagih/schema`
  - [x] **No** `authenticated` / `requireScope` macros — public within `/v1` group
  - [x] Wire in `apps/api/src/app.ts` before authenticated routes
  - [x] Tests: unauthenticated 200 + body shape; optional authenticated 200 identical
- [x] Task 3 — Validate route handler + HTTP mapping (AC: 3–6, 8, 9)
  - [x] Create `apps/api/src/routes/v1/validate-by-document-type.ts` — POST `/{invoices|quotations|receipts}/validate` with `authenticated: true`, `requireScope: "renders:write"`
  - [x] Create `apps/api/src/lib/map-validate-result.ts` — maps `ValidateUseCaseResult` → HTTP status + body or envelope (success flat JSON; failure → `respondApiErrorFromContext`)
  - [x] Handler: parse JSON body as `unknown`, map path segment → `DocumentType`, call `validateUseCase`
  - [x] Wire in `app.ts` alongside render stub routes
- [x] Task 4 — Scope registry + parity tests (AC: 10)
  - [x] Extend `packages/schema/src/auth/scopes.ts` `ROUTE_SCOPE_REQUIREMENTS`
  - [x] Update `apps/api/src/routes/v1/session.token.test.ts` matrix rows for validate routes
- [x] Task 5 — Tests (AC: 11, 12)
  - [x] `apps/api/src/routes/v1/schemas.test.ts`
  - [x] `apps/api/src/routes/v1/validate-by-document-type.test.ts` — table-driven across three types + failure cases
  - [x] `apps/api/src/lib/map-validate-result.test.ts`
  - [x] `apps/api/src/integration/validate.integration.test.ts` — postgres-gated E2E for all three types
- [x] Task 6 — Verification gate (AC: 13)
  - [x] `bun test apps/api`
  - [x] `bun test packages/schema` (if scopes.ts changed)
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Expose **schema discovery** (`GET /v1/schemas`) and **validate-only** (`POST /v1/{documentType}/validate`) HTTP routes. Wire thin Elysia handlers to existing `getSchemaMetadata()` (Story 2.4) and `validateUseCase()` (Story 3.2). Map use-case results to AD-11 HTTP responses (Story 3.6). No render side effects, no audit, no quota.

### Binding ratified sources

| Ref | Requirement for 3.9 |
| --- | --- |
| **FR-3** | GET `/v1/schemas` returns current version, document types, template enums; authority for SDK drift (Story 7.3) |
| **FR-11** | Valid → `{ valid: true, normalizedPreview }`; invalid → structured 422 envelope |
| **FR-1** | Path `documentType` authoritative; body mismatch → `400 DOCUMENT_TYPE_MISMATCH` |
| **AD-1** | Route handlers call `@usetagih/core` use-case — not `@usetagih/schema` orchestrator directly |
| **AD-11** | Errors via `buildApiErrorEnvelope` + `getHttpStatusForErrorCode` |
| **AD-12** | `GET /v1/schemas` is contract authority |
| **PRD §10.3** | HTTP mapping: 400 mismatch/unsupported version; 422 validation; flat success bodies |
| **PRD UJ-2** | Embed flow: validate before render with scoped API key |
| **Story 2.4** | `getSchemaMetadata()` + `SchemaMetadataSchema` — **reuse verbatim** |
| **Story 3.2** | `validateUseCase` — **reuse verbatim**; normalizedPreview = full parsed `DocumentPayload` |
| **Story 3.6** | `respondApiError` / `getRequestId`; success bodies flat |
| **Story 3.8** | Document-type path plural segments (`invoices`, etc.) — align mapping |

### Scope boundary: 3.9 vs adjacent stories

| Capability | Owner | 3.9 delivers |
| --- | --- | --- |
| `GET /v1/schemas` | **3.9** | Full |
| `POST /v1/{documentType}/validate` | **3.9** | Full |
| `validateUseCase` implementation | **3.2** | Already done — call only |
| Render stub idempotency routes | **3.8** | Unchanged (optional DRY refactor of path constants) |
| Preview `/preview` | **3.11** | Do not implement |
| Sync render calling validate | **3.12** | May compose validateUseCase in render handler later |
| Audit `validate` action | **3.15** | Do not log yet |
| SDK local validate | **7.1** | Parity target only |

### Evidence-based decisions (no human loop)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Schemas auth | Public (no macro) | Epics AC: "unauthenticated or authenticated" |
| Validate auth | `authenticated` + `renders:write` | PRD UJ-2 embed flow; validate is pre-render write path |
| Success validate body | `{ valid: true, normalizedPreview }` | PRD FR-11 / epics verbatim |
| Error validate body | AD-11 envelope only | Story 3.6 — errors never mixed with `{ valid: false }` |
| Use-case invocation | `validateUseCase` only | AD-1 hex boundary; Story 3.2 owns staging |
| Path mapping | Shared `document-type-paths.ts` | Same plural segments as Story 3.8 render routes |
| Unsupported schemaVersion HTTP | **400** | PRD §10.3 + `getHttpStatusForErrorCode` |
| Validation/business failures HTTP | **422** | PRD §10.3 |
| Document type mismatch HTTP | **400** | PRD §10.3 + FR-1 |
| Error message | Primary detail `message` or code default | Consistent with api-keys validation pattern |
| OpenAPI introspection | Automatic via Story 3.7 plugin | New routes appear in partial spec — no Story 7.4 blocker |

### Current state — files to read before editing

| File | Current state | 3.9 changes |
| --- | --- | --- |
| `packages/schema/src/version/metadata.ts` | `getSchemaMetadata()` ready | **No change** — import in route |
| `packages/core/src/use-cases/validate-use-case.ts` | Full use-case | **No change** — import in route |
| `apps/api/src/app.ts` | `/v1` chain with render stubs | Add schemas + validate routes |
| `apps/api/src/routes/v1/render-by-document-type.stub.ts` | Local `RENDER_DOCUMENT_TYPE_PATHS` | Optional refactor to shared lib |
| `apps/api/src/lib/api-error.ts` | Envelope helper | **Reuse** for validate failures |
| `packages/schema/src/auth/scopes.ts` | No validate entries in `ROUTE_SCOPE_REQUIREMENTS` | Add three POST validate rows |
| `packages/schema/src/errors/http-status.ts` | Code → status map | **Reuse** — no new codes |

### GET /v1/schemas handler (encode exactly)

**File:** `apps/api/src/routes/v1/schemas.ts`

```typescript
import { getSchemaMetadata } from "@usetagih/schema";
import { Elysia } from "elysia";

export function createSchemasRoutes() {
  return new Elysia({ name: "schemas" }).get("/schemas", () =>
    getSchemaMetadata(),
  );
}
```

Register inside `/v1` group **without** auth macros. Response is JSON serialized metadata — no caching headers required at MVP.

### Validate HTTP mapping (encode exactly)

**File:** `apps/api/src/lib/map-validate-result.ts`

```typescript
import type { ValidateUseCaseResult } from "@usetagih/core";
import { getHttpStatusForErrorCode } from "@usetagih/schema";

// Success: return { valid: true, normalizedPreview } with status 200
// Failure: respondApiErrorFromContext({ code, message, details })
//   message = details[0]?.message ?? defaultForCode(code)
// HTTP status from getHttpStatusForErrorCode(code) — never hardcode
```

**Execution flow per request:**

```
1. pathSegment = params from route (invoices|quotations|receipts)
2. pathDocumentType = pathSegmentToDocumentType(pathSegment)
3. rawPayload = await request.json()  // Elysia body parser → unknown
4. result = validateUseCase({ pathDocumentType, rawPayload })
5. if result.valid → 200 { valid: true, normalizedPreview: result.normalizedPreview }
6. else → respondApiErrorFromContext with result.code + result.details
```

### Document type path mapping (encode exactly)

**File:** `apps/api/src/lib/document-type-paths.ts`

```typescript
export const DOCUMENT_TYPE_PATHS = ["invoices", "quotations", "receipts"] as const;

export const PATH_SEGMENT_TO_DOCUMENT_TYPE = {
  invoices: "invoice",
  quotations: "quotation",
  receipts: "receipt",
} as const satisfies Record<(typeof DOCUMENT_TYPE_PATHS)[number], DocumentType>;

export function pathSegmentToDocumentType(segment: string): DocumentType | null {
  return segment in PATH_SEGMENT_TO_DOCUMENT_TYPE
    ? PATH_SEGMENT_TO_DOCUMENT_TYPE[segment as keyof typeof PATH_SEGMENT_TO_DOCUMENT_TYPE]
    : null;
}
```

Register routes **only** for known segments — do not use dynamic `:documentType` param that accepts arbitrary strings without validation (would leak validation errors for nonsense paths).

### Plugin / route order (encode exactly)

Inside `/v1` group (extend Story 3.6/3.8 order):

```
cors → workspaceGuard → authResolver → scopeGuard →
  session/csrf/token routes
  api-keys routes
  schemas route (GET /schemas — no auth macro)          ← NEW
  validate-by-document-type routes (POST /*/validate)  ← NEW
  render-by-document-type stub routes
  renders list stub
  audit/webhooks stubs
  → v1ErrorHandler
```

Root order from Story 3.7 unchanged (request-id → otel → evlog → security → openapi).

### Testing requirements

| Test file | Covers |
| --- | --- |
| `apps/api/src/routes/v1/schemas.test.ts` | 200 unauthenticated; body matches `getSchemaMetadata()` |
| `apps/api/src/lib/map-validate-result.test.ts` | Maps success 200; VALIDATION_FAILED → 422; DOCUMENT_TYPE_MISMATCH → 400; UNSUPPORTED_SCHEMA_VERSION → 400 |
| `apps/api/src/routes/v1/validate-by-document-type.test.ts` | Three types valid minimal fixtures; mismatch; structural 422; scope denial |
| `apps/api/src/integration/validate.integration.test.ts` | E2E all three types with real auth |

**Fixture paths (reuse Story 2.6 — do not copy JSON into api tests):**

```typescript
import invoiceMinimal from "../../../../packages/schema/__fixtures__/valid/invoice-minimal.json";
import quotationMinimal from "../../../../packages/schema/__fixtures__/valid/quotation-minimal.json";
import receiptMinimal from "../../../../packages/schema/__fixtures__/valid/receipt-minimal.json";
```

**Failure fixtures:** `invalid/schema-version/unsupported-2025-01-01.json`, `invalid/structural/missing-buyer-invoice.json`, document-type mismatch via body override on invoice path.

### Verification (required)

- Unit tests: `bun test apps/api` (+ `bun test packages/schema` if scopes changed)
- Workspace gate: `bunx turbo run lint typecheck test build --force` from repo root (always `--force`)
- Epic 2 action items: if OpenAPI structural tests enumerate routes/codes, update atomically with any schema export changes

### Previous story intelligence (3.8)

- Document-type paths: `invoices|quotations|receipts` — validate uses **same** plural URL segments as render
- `@ts-nocheck` on Elysia macro route files is accepted pattern when macros from composed plugins aren't inferred
- Integration tests reuse sign-up + session token helpers; `probeDb()` skip when postgres unavailable
- Render stub explicitly deferred `validateUseCase` — **3.9 is the owner**

### Previous story intelligence (3.2)

- `validateUseCase` returns `{ valid: false, code, details }` — HTTP layer maps to envelope; use-case has **no** `requestId`
- `normalizedPreview` is full parsed `DocumentPayload` with defaulted `schemaVersion` — return verbatim in 200 body
- Do not import `@usetagih/schema` validation orchestrator in routes when use-case exists

### Previous story intelligence (3.6)

- Success responses stay **flat** — `{ valid: true, normalizedPreview }` is flat JSON, not envelope-wrapped
- `respondApiErrorFromContext` ensures `X-Request-Id` + security headers on error paths
- Malformed JSON body → existing v1 error handler returns 422 `VALIDATION_FAILED` before handler runs

### Previous story intelligence (2.4)

- `getSchemaMetadata()` output validated by `SchemaMetadataSchema` in schema tests — API test can assert equality to `getSchemaMetadata()` call
- MVP single version `2026-07-20`; `supportedVersions` is `["2026-07-20"]`

### Git intelligence (baseline e4326b0)

Recent Epic 3 patterns:

- Route modules: `createXxxRoutes()` factory returning Elysia plugin; wire in `app.ts`
- Colocated `*.test.ts`; integration under `apps/api/src/integration/`
- `.js` extension in relative imports (NodeNext)
- `@usetagih/core` already in `apps/api/package.json` dependencies

### Latest technical specifics

| API | Guidance |
| --- | --- |
| `getSchemaMetadata()` | Sync; no I/O; safe to call per request at MVP scale |
| `validateUseCase()` | Sync CPU-only; no db/render deps |
| Elysia POST body | Use default JSON parser; body typed `unknown` before use-case |
| Error code → status | Always `getHttpStatusForErrorCode(code)` from schema |

### Project Structure Notes

```
apps/api/src/
├── lib/
│   ├── document-type-paths.ts       # NEW (shared with render stub)
│   ├── document-type-paths.test.ts  # NEW
│   └── map-validate-result.ts       # NEW
├── routes/v1/
│   ├── schemas.ts                   # NEW
│   ├── schemas.test.ts              # NEW
│   ├── validate-by-document-type.ts # NEW
│   └── validate-by-document-type.test.ts # NEW
└── integration/
    └── validate.integration.test.ts # NEW

packages/schema/src/auth/
└── scopes.ts                        # UPDATE — ROUTE_SCOPE_REQUIREMENTS
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.9 ACs]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — FR-3, FR-11, §10.1, §10.3]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-1, AD-12]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md` — §4.1 validate stage]
- [Source: `_bmad-output/implementation-artifacts/2-4-schema-version-negotiation-helpers.md` — getSchemaMetadata contract]
- [Source: `_bmad-output/implementation-artifacts/3-2-packages-core-ports-and-validate-use-case.md` — validateUseCase]
- [Source: `_bmad-output/implementation-artifacts/3-6-auth-middleware-request-id-and-unified-error-envelope.md` — envelope helper]
- [Source: `_bmad-output/implementation-artifacts/3-8-idempotency-middleware-for-render-endpoints.md` — path segments, deferred validate]
- [Source: `packages/schema/src/version/metadata.ts` — getSchemaMetadata]
- [Source: `packages/core/src/use-cases/validate-use-case.ts` — use-case contract]
- [Source: `packages/schema/__fixtures__/valid/` — minimal fixtures for integration tests]

## Dev Agent Record

### Agent Model Used

composer-2.5-fast

### Debug Log References

### Completion Notes List

- added public `GET /v1/schemas` returning `getSchemaMetadata()` flat JSON
- added authenticated `POST /v1/{invoices|quotations|receipts}/validate` wired to `validateUseCase` via `mapValidateResultToResponse`
- extracted shared `document-type-paths.ts` and refactored render stub to reuse mapping
- extended `ROUTE_SCOPE_REQUIREMENTS` and session token scope parity tests for validate routes
- unit + postgres-gated integration tests for all three document types
- verification: `bunx turbo run lint typecheck test build --force` exit 0; `@usetagih/api` 115 pass

### File List

- `apps/api/src/lib/document-type-paths.ts` (new)
- `apps/api/src/lib/document-type-paths.test.ts` (new)
- `apps/api/src/lib/map-validate-result.ts` (new)
- `apps/api/src/lib/map-validate-result.test.ts` (new)
- `apps/api/src/routes/v1/schemas.ts` (new)
- `apps/api/src/routes/v1/schemas.test.ts` (new)
- `apps/api/src/routes/v1/validate-by-document-type.ts` (new)
- `apps/api/src/routes/v1/validate-by-document-type.test.ts` (new)
- `apps/api/src/integration/validate.integration.test.ts` (new)
- `apps/api/src/app.ts` (modified)
- `apps/api/src/routes/v1/render-by-document-type.stub.ts` (modified)
- `apps/api/src/routes/v1/session.token.test.ts` (modified)
- `packages/schema/src/auth/scopes.ts` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-07-20: story 3.9 implementation — schemas discovery + validate-only routes (status → review)
- 2026-07-20: adversarial code review — no medium+ findings; status → done

## Code Review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.9 schemas + validate)  
**Implementation:** PR #19 @ `51d55aa`  
**Verdict:** **PASS** — all 14 ACs satisfied; no medium+ code fixes required

### AC checklist (14/14)

| AC | Result | Notes |
| --- | --- | --- |
| 1 | PASS | `GET /v1/schemas` unauthenticated → 200 flat `getSchemaMetadata()` body (not envelope-wrapped) |
| 2 | PASS | Authenticated session bearer → identical 200 body; auth does not change shape or require workspace |
| 3 | PASS | `POST /v1/{invoices\|quotations\|receipts}/validate` with `renders:write` → 200 `{ valid: true, normalizedPreview }` with defaulted `schemaVersion: "2026-07-20"` |
| 4 | PASS | Failures map via `mapValidateResultToResponse` → AD-11 envelope; structural/business failures → 422 (`VALIDATION_FAILED` top-level, business codes in `details[]`) |
| 5 | PASS | Path/body `documentType` mismatch → 400 `DOCUMENT_TYPE_MISMATCH` with `/documentType` detail |
| 6 | PASS | Unsupported `schemaVersion` → 400 `UNSUPPORTED_SCHEMA_VERSION` with `/schemaVersion` detail |
| 7 | PASS | Unknown path segment → 404 `NOT_FOUND` via `/v1` catch-all |
| 8 | PASS | Missing auth → 401 `UNAUTHORIZED`; insufficient scope → 403 `FORBIDDEN` |
| 9 | PASS | Handler calls `validateUseCase({ pathDocumentType, rawPayload })` only; shared `document-type-paths.ts` mapping |
| 10 | PASS | `ROUTE_SCOPE_REQUIREMENTS` includes three validate routes → `renders:write`; `session.token.test.ts` matrix extended |
| 11 | PASS | Unit tests: schemas 200; validate happy path per type; 422 structural; 400 mismatch/unsupported version; auth/scope denial |
| 12 | PASS | Postgres-gated integration: sign-up → API key → validate all three minimal fixtures → 200 + correct `normalizedPreview.documentType` |
| 13 | PASS | `docker compose postgres` + `bunx turbo run lint typecheck test build --force` → 36/36 exit 0 |
| 14 | PASS | No audit, preview, render pipeline, SDK, OpenAPI Spectral, quota, or idempotency changes |

### Findings triage

| ID | Sev | Bucket | Title | Resolution |
| --- | --- | --- | --- | --- |
| CR-1 | low | defer | No dedicated HTTP test for `LINE_TOTAL_MISMATCH` / `TAX_TOTAL_MISMATCH` | Same `mapValidateResultToResponse` path as structural 422; `validateUseCase` returns `VALIDATION_FAILED` top-level with business codes in `details` per PRD §10.3 |
| CR-2 | low | dismiss | `defaultMessageForCode` returns identical fallback for all codes | Use case always supplies `details[0].message`; fallback unreachable for mapped failure codes |
| CR-3 | low | dismiss | `@ts-nocheck` on validate route module | Accepted — same Elysia macro pattern as Stories 3.4/3.7/3.8 |
| CR-4 | low | dismiss | Integration test uses API key path only (not session token) | AC 12 allows either; unit test covers session bearer; integration covers sign-up → scoped API key E2E |

### Verification run

| Gate | Result | Notes |
| --- | --- | --- |
| `docker compose -f docker/compose.yml up -d postgres` | **PASS** | Container healthy |
| `bunx turbo run lint typecheck test build --force` | **36/36 exit 0** | `@usetagih/api` 115 pass / 0 fail |

## Story Validation Record

**Validated:** 2026-07-20 (headless checklist — create-story step 6)

| Check | Result |
| --- | --- |
| getSchemaMetadata reuse from Story 2.4 | PASS |
| validateUseCase reuse from Story 3.2 (no restaging in api) | PASS |
| HTTP status mapping per PRD §10.3 (400 vs 422) | PASS |
| Schemas public; validate authenticated + renders:write | PASS |
| Path plural segments aligned with Story 3.8 render routes | PASS |
| AD-11 envelope on errors; flat success bodies | PASS |
| Integration tests for all three document types | PASS |
| Out of scope boundaries (audit, preview, render, SDK) | PASS |
| Verification commands with turbo `--force` | PASS |
| ROUTE_SCOPE_REQUIREMENTS update specified | PASS |
