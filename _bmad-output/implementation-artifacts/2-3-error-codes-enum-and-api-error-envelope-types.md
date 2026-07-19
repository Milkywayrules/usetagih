---
baseline_commit: f71cd845f5475b557f2c556cc0845652f50d6129
---

# Story 2.3: Error codes enum and API error envelope types

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an SDK consumer,
I want typed error codes mapping 1:1 to HTTP statuses,
so that clients handle failures consistently (FR-2, NFR-7, AD-11).

## Acceptance Criteria

1. **Given** `packages/schema/src/errors/` is the **single source of truth** for all API error codes, **when** `@usetagih/schema` is built, **then** it exports a closed `ErrorCode` union, per-code string constants, `ERROR_CODES` readonly array, and `getHttpStatusForErrorCode(code)` with exactly one HTTP status per code per PRD §10.3 table below — no duplicate literals elsewhere in the package.
2. **Given** PRD §10.3 envelope shape, **when** `buildApiErrorEnvelope({ code, message, requestId, details? })` runs, **then** output matches `{ error: { code, message, requestId, details[] } }` with `details` defaulting to `[]` when omitted; top-level `code` is the response-level code; each detail may carry its own `code` (PRD example: top `VALIDATION_FAILED`, detail `TAX_TOTAL_MISMATCH`).
3. **Given** Zod schemas `ApiErrorDetailSchema` and `ApiErrorEnvelopeSchema` (both `.strict()`), **when** envelope builder output is parsed, **then** parse succeeds; detail fields: required `path` (JSON Pointer string), `code` (`ErrorCode`), `message` (string); optional `expected?`, `received?` (strings).
4. **Given** Story 2.1 seam `document/document-type-mismatch.ts` and Story 2.2 seam `validation/codes.ts`, **when** migration completes, **then** `DOCUMENT_TYPE_MISMATCH_CODE`, `LINE_TOTAL_MISMATCH_CODE`, `TAX_TOTAL_MISMATCH_CODE`, and `VALIDATION_FAILED_CODE` are defined **only** in `errors/codes.ts`; `validation/codes.ts` and `document-type-mismatch.ts` import/re-export from there; `@usetagih/schema` public exports remain backward-compatible (same named exports from `index.ts`).
5. **Given** `BusinessRuleFinding` from Story 2.2, **when** `businessFindingToDetail(finding)` runs, **then** returns an `ApiErrorDetail` with the same `path`, `code`, `message`, `expected?`, `received?`; finding `code` field type narrows to `ErrorCode`.
6. **Given** `UNSUPPORTED_SCHEMA_VERSION` in the enum (HTTP 400), **when** Story 2.4 adds version negotiation, **then** it imports this code — **no new enum entry in 2.4**; 2.4 only wires rejection logic and supported-version message text.
7. **Given** `packages/schema/src/errors/`, **when** `bun test packages/schema` runs, **then** tests assert: (a) `ERROR_CODES` length equals PRD §10.3 closed set (13 codes); (b) every code maps to exactly one status; (c) no two codes share a status where PRD assigns a dedicated code (`402`/`429` exclusivity); (d) envelope builder round-trip through Zod; (e) **no bare string error codes** in exported schema helpers (see Dev Notes §Bare-string guard).
8. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
9. **Out of scope (Stories 2.4–2.6, Epic 3):** `schemaVersion` default injection, version negotiation helpers, OpenAPI component generation, Elysia middleware wiring, requestId generation (`req_` prefix — Story 3.6), HTTP response sending, webhook `render.failed` nested error shape (`RENDER_TIMEOUT` is webhook metadata, not API envelope — exclude from this enum).

## Tasks / Subtasks

- [ ] Task 1 — Canonical error codes module (AC: 1, 4, 6)
  - [ ] Create `errors/codes.ts` with full PRD §10.3 closed set + exports
  - [ ] Create `errors/http-status.ts` with `getHttpStatusForErrorCode` + inverse guard in tests
  - [ ] Migrate `validation/codes.ts` to re-export from `errors/codes.ts` (remove duplicated literals)
  - [ ] Migrate `document/document-type-mismatch.ts` to import `DOCUMENT_TYPE_MISMATCH_CODE` from `errors/codes.ts`
- [ ] Task 2 — Envelope + detail types (AC: 2, 3, 5)
  - [ ] Create `errors/detail.ts` — `ApiErrorDetailSchema` (`.strict()`), type, `businessFindingToDetail()`
  - [ ] Create `errors/envelope.ts` — `ApiErrorEnvelopeSchema` (`.strict()`), type, `buildApiErrorEnvelope()`
  - [ ] Update `validation/finding.ts` — `code: ErrorCode`
- [ ] Task 3 — Public exports (AC: 4)
  - [ ] Update `src/index.ts` — export errors module surface without breaking existing validation/document exports
- [ ] Task 4 — Tests (AC: 7)
  - [ ] `errors/codes.test.ts` — completeness, HTTP mapping, exclusivity
  - [ ] `errors/envelope.test.ts` — builder defaults, PRD example fixture, Zod round-trip
  - [ ] `errors/bare-string-guard.test.ts` — static export audit (see Dev Notes)
- [ ] Task 5 — Verification gate (AC: 8)
  - [ ] `bun test packages/schema`
  - [ ] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Formalize the **canonical API error contract** in `@usetagih/schema`: closed error-code enum with 1:1 HTTP status mapping (AD-11, NFR-7), Zod-typed envelope + detail shapes matching PRD §10.3 exactly, and a builder helpers layer Epic 3 middleware will call (Story 3.6). Reconcile Story 2.1/2.2 string-literal seams into one module.

### PRD §10.3 — authoritative envelope (quote exactly)

From [PRD §10.3](_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md):

> All errors use the envelope; `details` may be empty. Each documented error code maps to exactly one stable HTTP status.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Payload failed schema validation",
    "requestId": "req_01H...",
    "details": [
      {
        "path": "/totals/grandTotal",
        "code": "TAX_TOTAL_MISMATCH",
        "message": "taxTotal 110.00 does not match sum of taxLines 108.90",
        "expected": "108.90",
        "received": "110.00"
      }
    ]
  }
}
```

HTTP mapping line (PRD §10.3 — **closed set source**; epics AC `"etc."` defers here):

> HTTP mapping (one code → one status): `400` invalid request, unsupported schema version, `DOCUMENT_TYPE_MISMATCH`; `401`/`403` auth/scope; `402` `QUOTA_EXCEEDED` only; `404` not found; `409` idempotency conflict; `422` validation (`VALIDATION_FAILED`, `LINE_TOTAL_MISMATCH`, `TAX_TOTAL_MISMATCH`, etc.); `429` `RATE_LIMITED` only; `500` internal.

### Complete `ErrorCode` enum — PRD §10.3 closed set (implement exactly)

| Code constant | HTTP | PRD §10.3 category |
| --- | ---: | --- |
| `INVALID_REQUEST` | 400 | invalid request — malformed body, bad params, invalid template (FR-6 uses this code) |
| `UNSUPPORTED_SCHEMA_VERSION` | 400 | unsupported schema version (FR-3; **enum now**, wiring in Story 2.4) |
| `DOCUMENT_TYPE_MISMATCH` | 400 | explicit (FR-1; Story 2.1 helper) |
| `UNAUTHORIZED` | 401 | auth failure — missing/invalid/revoked credentials (FR-23) |
| `FORBIDDEN` | 403 | auth/scope — insufficient scope, CSRF failure (FR-22) |
| `QUOTA_EXCEEDED` | 402 | **only** code for 402 (FR-17) |
| `NOT_FOUND` | 404 | not found; cross-tenant access uses 404 not 403 (NFR-5) |
| `IDEMPOTENCY_CONFLICT` | 409 | idempotency conflict (FR-24) |
| `VALIDATION_FAILED` | 422 | generic validation / structural / business rules not covered by dedicated codes |
| `LINE_TOTAL_MISMATCH` | 422 | explicit (FR-9, Story 2.2) |
| `TAX_TOTAL_MISMATCH` | 422 | explicit (FR-9, Story 2.2) |
| `RATE_LIMITED` | 429 | **only** code for 429 (FR-17) |
| `INTERNAL_ERROR` | 500 | internal / unexpected server failure |

**Excluded from API envelope enum (different contracts):**

| Code | Where | Why excluded |
| --- | --- | --- |
| `RENDER_TIMEOUT` | Webhook `render.failed` event `data.error` (PRD §10.5) | Not REST error envelope; retriable flag lives in webhook payload |

**`UNSUPPORTED_SCHEMA_VERSION` decision:** Include in Story 2.3 enum + HTTP map now so Epic 3 and OpenAPI (2.5) reference a stable symbol. Story 2.4 implements `assertSupportedSchemaVersion()` / default injection that **returns/throws using this code** — no second enum definition.

### AD-11 / NFR-7 / FR-2 requirements

| Ref | Requirement for this story |
| --- | --- |
| **AD-11** | Envelope shape `{ error: { code, message, requestId, details[] } }`; one code → one HTTP status |
| **NFR-7** | No bare string errors from schema helpers — codes must flow through `ErrorCode` |
| **FR-2** | Details carry JSON Pointer `path`, machine `code`, human `message`, optional `expected`/`received` |

**requestId semantics:** Builder accepts `requestId` as opaque string; generation (`req_` ULID prefix) is Story 3.6 middleware — pass through unchanged in builder.

### Migration — single source of truth (implement exactly)

**Decision:** Canonical definitions live in `errors/codes.ts`. Legacy seam files become thin re-exports — **zero duplicated string literals**.

```typescript
// errors/codes.ts — ONLY place string literals are defined
export const VALIDATION_FAILED_CODE = "VALIDATION_FAILED" as const;
export const LINE_TOTAL_MISMATCH_CODE = "LINE_TOTAL_MISMATCH" as const;
export const TAX_TOTAL_MISMATCH_CODE = "TAX_TOTAL_MISMATCH" as const;
export const DOCUMENT_TYPE_MISMATCH_CODE = "DOCUMENT_TYPE_MISMATCH" as const;
export const INVALID_REQUEST_CODE = "INVALID_REQUEST" as const;
export const UNSUPPORTED_SCHEMA_VERSION_CODE = "UNSUPPORTED_SCHEMA_VERSION" as const;
export const UNAUTHORIZED_CODE = "UNAUTHORIZED" as const;
export const FORBIDDEN_CODE = "FORBIDDEN" as const;
export const QUOTA_EXCEEDED_CODE = "QUOTA_EXCEEDED" as const;
export const NOT_FOUND_CODE = "NOT_FOUND" as const;
export const IDEMPOTENCY_CONFLICT_CODE = "IDEMPOTENCY_CONFLICT" as const;
export const RATE_LIMITED_CODE = "RATE_LIMITED" as const;
export const INTERNAL_ERROR_CODE = "INTERNAL_ERROR" as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export const ERROR_CODES = [
  "DOCUMENT_TYPE_MISMATCH",
  "FORBIDDEN",
  "IDEMPOTENCY_CONFLICT",
  "INTERNAL_ERROR",
  "INVALID_REQUEST",
  "LINE_TOTAL_MISMATCH",
  "NOT_FOUND",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "TAX_TOTAL_MISMATCH",
  "UNAUTHORIZED",
  "UNSUPPORTED_SCHEMA_VERSION",
  "VALIDATION_FAILED",
] as const;
```

```typescript
// validation/codes.ts — AFTER migration (no local literals)
export {
  LINE_TOTAL_MISMATCH_CODE,
  TAX_TOTAL_MISMATCH_CODE,
  VALIDATION_FAILED_CODE,
} from "../errors/codes";
```

```typescript
// document/document-type-mismatch.ts — AFTER migration
import { DOCUMENT_TYPE_MISMATCH_CODE } from "../errors/codes";
export { DOCUMENT_TYPE_MISMATCH_CODE }; // re-export for backward compat if needed
// remove: export const DOCUMENT_TYPE_MISMATCH_CODE = "DOCUMENT_TYPE_MISMATCH" as const;
```

Update `validate-arithmetic.ts` imports if they reference `./codes` — path may stay `./codes` (re-export) or switch to `../errors/codes`; either is fine if literals exist only in `errors/codes.ts`.

### File layout (implement exactly)

```text
packages/schema/src/errors/
├── codes.ts                    # ErrorCode union, constants, ERROR_CODES array
├── codes.test.ts               # completeness + HTTP 1:1 mapping
├── http-status.ts              # getHttpStatusForErrorCode(code: ErrorCode): number
├── detail.ts                   # ApiErrorDetailSchema (.strict()), businessFindingToDetail()
├── envelope.ts                 # ApiErrorEnvelopeSchema (.strict()), buildApiErrorEnvelope()
├── envelope.test.ts            # PRD §10.3 example fixture + defaults
└── bare-string-guard.test.ts   # export surface audit (AC 7e)

packages/schema/src/validation/
├── codes.ts                    # re-export only (migration)
└── finding.ts                  # code: ErrorCode

packages/schema/src/document/
└── document-type-mismatch.ts   # import DOCUMENT_TYPE_MISMATCH_CODE from ../errors/codes
```

Do **not** create `src/openapi/` (Story 2.5). Do **not** add HTTP client or Elysia code (Epic 3).

### Zod schemas (`.strict()` per Story 2.1 convention)

```typescript
// detail.ts
export const ApiErrorDetailSchema = z
  .object({
    path: z.string().min(1),
    code: z.enum(/* derive from ERROR_CODES or ErrorCodeSchema */),
    message: z.string().min(1),
    expected: z.string().optional(),
    received: z.string().optional(),
  })
  .strict();

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;
```

```typescript
// envelope.ts
export const ApiErrorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.enum(/* ErrorCode */),
        message: z.string().min(1),
        requestId: z.string().min(1),
        details: z.array(ApiErrorDetailSchema),
      })
      .strict(),
  })
  .strict();

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
```

Use `z.enum()` built from `ERROR_CODES` tuple to keep schema and TypeScript union in sync.

### Builder function signatures

```typescript
export type BuildApiErrorEnvelopeInput = {
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: readonly ApiErrorDetail[];
};

export function buildApiErrorEnvelope(
  input: BuildApiErrorEnvelopeInput,
): ApiErrorEnvelope;

export function businessFindingToDetail(
  finding: BusinessRuleFinding,
): ApiErrorDetail;
```

**Defaults:** `details` omitted → `[]`. Builder does **not** validate `requestId` prefix — callers supply `req_...` in Epic 3.

**Epic 3 usage seam (document only — implement in 3.6):**

```typescript
const envelope = buildApiErrorEnvelope({
  code: VALIDATION_FAILED_CODE,
  message: "Payload failed validation",
  requestId,
  details: findings.map(businessFindingToDetail),
});
const status = getHttpStatusForErrorCode(envelope.error.code);
```

### Bare-string guard test strategy (AC 7e)

`bare-string-guard.test.ts` must fail CI if exported error paths regress to raw strings:

1. **Static re-export check:** `ERROR_CODES.every(code => typeof code === "string")` and each constant equals its literal (already covered in codes.test.ts).
2. **Module import check:** Import `DOCUMENT_TYPE_MISMATCH_CODE`, validation code constants, and assert each is an element of `ERROR_CODES`.
3. **Finding type check:** TypeScript compile-time — `BusinessRuleFinding["code"]` is `ErrorCode` (no `string`).
4. **Optional grep-style test:** Read `validate-arithmetic.ts`, `document-type-mismatch.ts`, `validate-document-payload.ts` source as text; assert no match for `code:\s*"` string assignments outside imports — or assert they import from `errors/codes` / `./codes` re-export only.

Goal: prevent new helpers from exporting ad-hoc `"SOME_ERROR"` strings bypassing the enum.

### Test fixtures

**PRD §10.3 example** — hard-code in `envelope.test.ts`:

```typescript
const prdExample = buildApiErrorEnvelope({
  code: "VALIDATION_FAILED",
  message: "Payload failed schema validation",
  requestId: "req_01H...",
  details: [
    {
      path: "/totals/grandTotal",
      code: "TAX_TOTAL_MISMATCH",
      message:
        "taxTotal 110.00 does not match sum of taxLines 108.90",
      expected: "108.90",
      received: "110.00",
    },
  ],
});
expect(ApiErrorEnvelopeSchema.parse(prdExample)).toEqual(prdExample);
```

**Bridge test:** Load `__fixtures__/invalid/arithmetic/tax-total-mismatch.json`, run `validateDocumentPayload`, map findings via `businessFindingToDetail`, assert detail `code === TAX_TOTAL_MISMATCH_CODE` and `getHttpStatusForErrorCode(TAX_TOTAL_MISMATCH_CODE) === 422`.

**HTTP exclusivity tests:**

```typescript
expect(getHttpStatusForErrorCode("QUOTA_EXCEEDED")).toBe(402);
expect(getHttpStatusForErrorCode("RATE_LIMITED")).toBe(429);
expect(ERROR_CODES.filter(c => getHttpStatusForErrorCode(c) === 402)).toEqual(["QUOTA_EXCEEDED"]);
expect(ERROR_CODES.filter(c => getHttpStatusForErrorCode(c) === 429)).toEqual(["RATE_LIMITED"]);
```

### Epic 2 cross-story boundaries

| Story | Owns | Not in 2.3 |
| --- | --- | --- |
| **2.1 (done)** | Structural Zod, `checkDocumentTypeMismatch` | — |
| **2.2 (done)** | `validateDocumentPayloadArithmetic`, `BusinessRuleFinding` | — |
| **2.3 (this)** | `errors/` enum, HTTP map, envelope/detail Zod + builder, code migration | — |
| 2.4 | `schemaVersion` default, `assertSupportedSchemaVersion`, `getSchemaMetadata()` | Uses `UNSUPPORTED_SCHEMA_VERSION` from this story |
| 2.5 | OpenAPI generation referencing envelope components | References types from this story |
| 2.6 | ≥20 failure fixtures, SM-2 coverage | May add more detail paths |

### Public exports (`src/index.ts`)

Add (minimum):

- `ErrorCode`, `ERROR_CODES`
- All `*_CODE` constants (including migrated ones already exported)
- `getHttpStatusForErrorCode`
- `ApiErrorDetailSchema`, `ApiErrorDetail`
- `ApiErrorEnvelopeSchema`, `ApiErrorEnvelope`
- `buildApiErrorEnvelope`, `businessFindingToDetail`

Keep existing validation/document exports unchanged.

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Baseline commit | `f71cd845f5475b557f2c556cc0845652f50d6129` (Story 2.2 done) |
| Zod version | `^4.4.3` (same as Stories 2.1–2.2) |
| Turbo verification | `bunx turbo run lint typecheck test build --force` |
| Unit tests | `bun test packages/schema` |
| No new dependencies | Zod only |

### Anti-patterns (do not)

- Do not duplicate error string literals in `validation/codes.ts` or `document-type-mismatch.ts` after migration.
- Do not add HTTP middleware or status-code sending in schema package.
- Do not include webhook-only codes (`RENDER_TIMEOUT`) in API `ErrorCode`.
- Do not use `.passthrough()` on envelope/detail schemas.
- Do not create OpenAPI generator files (Story 2.5).
- Do not change arithmetic validation logic beyond typing `finding.code` as `ErrorCode`.

### Previous story intelligence (2.2)

| Source | Learning for 2.3 |
| --- | --- |
| Story 2.2 | `validation/codes.ts` holds three constants as deliberate seam — migrate, don't delete public names |
| Story 2.2 | `BusinessRuleFinding` shape matches PRD detail fields — `businessFindingToDetail` is thin mapping |
| Story 2.2 | `validateDocumentPayload` orchestration returns findings array — Epic 3 maps to envelope `details[]` |
| Story 2.1 | `DOCUMENT_TYPE_MISMATCH_CODE` in `document-type-mismatch.ts` — same migration pattern |

### Git intelligence (recent Epic 2 work)

| Commit | Relevance |
| --- | --- |
| `f71cd84` chore: mark story 2-2 done | Baseline after arithmetic validators merged |
| `93e2059` feat: arithmetic integrity validators | Established `validation/` module; codes.ts seam |
| `808fd81` feat: document payload zod union | `document-type-mismatch.ts` pattern |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.3 ACs]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — §10.3 envelope + HTTP mapping, FR-2, FR-3, FR-6, FR-17, FR-22–24, NFR-7]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-11]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md` — §6 repo layout `src/errors/`]
- [Source: `_bmad-output/implementation-artifacts/2-2-business-rule-validators-for-arithmetic-integrity.md` — codes seam, finding shape]
- [Source: `_bmad-output/implementation-artifacts/2-1-document-payload-zod-discriminated-union.md` — DOCUMENT_TYPE_MISMATCH helper]
- [Source: `packages/schema/src/validation/codes.ts` — literals to migrate]
- [Source: `packages/schema/src/document/document-type-mismatch.ts` — literal to migrate]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-20: story context created for error codes enum and API error envelope types (Story 2.3)
