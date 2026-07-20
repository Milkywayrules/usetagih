---
baseline_commit: 740a720
created: 2026-07-20
---

# Story 3.6: Auth middleware, request-id, and unified error envelope

Status: review

## Story

As an API consumer,
I want Bearer auth middleware and consistent errors on all routes,
so that integration is predictable (NFR-7, AD-11, NFR-5).

## Acceptance Criteria

1. **Given** request-id middleware runs first on every `apps/api` request, **when** any response is sent (success or error), **then** response includes header `X-Request-Id` with value `req_<uuid>` (generate via `crypto.randomUUID()` — no new dependency); same value appears in every error envelope `error.requestId` field for that request.
2. **Given** inbound request carries `X-Request-Id` matching `/^req_[0-9a-f-]{36}$/i`, **when** middleware runs, **then** that value is reused (propagation for upstream proxies); malformed or missing values get a freshly generated `req_` id.
3. **Given** any `/v1/*` route returns an error — macro auth failures, scope guard, validation, stub 501, unknown route, unhandled exception — **when** the response body is JSON, **then** it matches AD-11 / PRD §10.3 shape built **exclusively** via `@usetagih/schema` exports `buildApiErrorEnvelope` and `getHttpStatusForErrorCode` — no inline `{ error: { code, message } }` literals without `requestId` and `details`.
4. **Given** Elysia/Zod route or body validation fails on a `/v1/*` route, **when** the framework surfaces a validation error, **then** HTTP status is `getHttpStatusForErrorCode("VALIDATION_FAILED")` (422) and envelope uses code `VALIDATION_FAILED` with `details[]` populated from `zodIssuesToDetails` in `@usetagih/schema` (empty `details` only when no issues available).
5. **Given** request to unknown `/v1/*` path, **when** no route matches, **then** HTTP **404** with code `NOT_FOUND`, message suitable for clients, `details: []`, and full envelope including `requestId`.
6. **Given** unhandled thrown error inside `/v1/*` handler chain, **when** global error handler runs, **then** HTTP **500** with code `INTERNAL_ERROR`, generic safe message (no stack trace, no raw `Error.message` in production-shaped responses), `details: []`, and full envelope including `requestId`.
7. **Given** Epic 3 stub routes (`GET|POST /v1/renders`, `GET /v1/audit`, `GET|POST /v1/webhooks`) still return HTTP **501**, **when** auth + scope guards pass, **then** envelope uses new schema code `NOT_IMPLEMENTED` (added in this story) via `buildApiErrorEnvelope` + `getHttpStatusForErrorCode` → **501**; existing scope-parity / integration tests continue to expect status **501** (code string may change from literal to enum constant — update assertions).
8. **Given** ad-hoc error returns today in auth mount, workspace guard, auth resolver, scope guard, session-management guard, api-keys routes, sign-up-with-workspace, and session.token, **when** this story merges, **then** each uses shared `apps/api` helper(s) that delegate to `buildApiErrorEnvelope` — **no** duplicated envelope assembly in route/macro files.
9. **Given** successful `/v1/*` responses (201 api-key create, 200 lists, health, session token exchange, sign-up composite), **when** returned, **then** bodies remain **flat** per PRD — success is **not** wrapped in an envelope (standardization applies to errors only).
10. **Given** API key and session bearer JWT (Story 3.4–3.5), **when** `Authorization: Bearer` is used, **then** existing auth resolution behavior is unchanged — this story only unifies **error shape**, not auth semantics.
11. **Given** cross-workspace resource access (e.g. `DELETE /v1/api-keys/{keyId}` for another workspace), **when** denied, **then** HTTP **404** `NOT_FOUND` (NFR-5 — not 403) with full envelope.
12. **Given** `bun test apps/api`, **when** run, **then** tests cover: 401/403/404 mapping with envelope + `requestId`; validation envelope with `details`; unknown-route envelope; internal-error envelope without stack leakage; stub 501 envelope; header `X-Request-Id` present on error responses.
13. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
14. **Out of scope (later Epic 3 stories):** OpenAPI publish / Scalar docs (Story 3.7); evlog wiring (Story 3.7); OTel trace attribute propagation (Story 3.7 — depends on request-id from this story); rate limits (Story 3.16); changing success response contracts; better-auth `/api/auth/*` error shapes (non-`/v1` JSON errors may stay plugin-native unless trivial to wrap).

## Tasks / Subtasks

- [x] Task 1 — Schema: `NOT_IMPLEMENTED` code (AC: 7, 3)
  - [x] Add `NOT_IMPLEMENTED` to `packages/schema/src/errors/codes.ts` + `ERROR_CODES` array
  - [x] Map `NOT_IMPLEMENTED → 501` in `packages/schema/src/errors/http-status.ts`
  - [x] Update `codes.test.ts` / `envelope.test.ts` / OpenAPI structural tests if they enumerate codes (Epic 2 action item: contract changes atomic)
  - [x] Export constant from `packages/schema/src/index.ts` if other constants are exported
- [x] Task 2 — Request-id middleware (AC: 1, 2)
  - [x] Create `apps/api/src/middleware/request-id.ts` — derive/store `requestId` on context; set `X-Request-Id` on response via `onAfterHandle` or equivalent
  - [x] Wire as **first** plugin in `createApp()` (before health/auth/v1 group) so all routes inherit
  - [x] Unit tests: generates `req_` prefix; reuses valid inbound header; rejects malformed inbound
- [x] Task 3 — Central API error helper (AC: 3, 8)
  - [x] Create `apps/api/src/lib/api-error.ts` — `respondApiError({ code, message, requestId, details?, set })` calling `buildApiErrorEnvelope` + `getHttpStatusForErrorCode` + `set.status`
  - [x] Optional thin wrapper `respondApiErrorFromContext(ctx, …)` reading `requestId` from Elysia context store
  - [x] **Do not** re-export schema types — import from `@usetagih/schema` at call sites only through this helper
- [x] Task 4 — Global `/v1` error handling (AC: 4, 5, 6)
  - [x] Add Elysia `onError` (or scoped plugin on `/v1` group) mapping: `NOT_FOUND` → 404 envelope; Zod/validation → 422 + `zodIssuesToDetails`; unknown → `INTERNAL_ERROR` 500
  - [x] Ensure `error.message` for 500 is constant generic string (e.g. `"An internal error occurred"`) — log real error server-side only (console or placeholder until Story 3.7 evlog)
  - [x] Register catch-all unknown route handler on `/v1` group **after** all routes for explicit 404 envelope (if framework default bypasses `onError`)
- [x] Task 5 — Replace ad-hoc envelopes (AC: 8, 11)
  - [x] `apps/api/src/auth/mount.ts` — `auth` macro 401
  - [x] `apps/api/src/middleware/workspace-guard.ts` — 401/403
  - [x] `apps/api/src/middleware/auth-resolver.ts` — 401/403
  - [x] `apps/api/src/middleware/scope-guard.ts` — 401/403
  - [x] `apps/api/src/middleware/session-management-auth.ts` — 403
  - [x] `apps/api/src/routes/v1/api-keys.ts` — validation + NOT_FOUND + FORBIDDEN paths
  - [x] `apps/api/src/routes/auth/sign-up-with-workspace.ts` — error catch paths (map better-auth codes to schema codes where possible; never leak raw plugin codes in envelope)
  - [x] `apps/api/src/routes/v1/session.token.ts` — CSRF/auth errors
  - [x] Stub files: `renders.stub.ts`, `audit.stub.ts`, `webhooks.stub.ts` — 501 via helper + `NOT_IMPLEMENTED`
- [x] Task 6 — Tests (AC: 12)
  - [x] `apps/api/src/middleware/error-envelope.test.ts` — unit-level helper + validation mapping
  - [x] Extend `apps/api/src/integration/auth.integration.test.ts` — assert `error.requestId`, `error.details`, `X-Request-Id` header on 401
  - [x] Extend `apps/api/src/integration/api-keys.integration.test.ts` — 404 envelope fields
  - [x] Add cases: `GET /v1/does-not-exist` → 404 envelope; forced 500 path (test-only route or mock throw) → no stack in body
  - [x] Update stub assertions: `NOT_IMPLEMENTED` code + envelope shape; keep status 501
  - [x] Update `session.token.test.ts` scope-parity rows if body shape assertions added
- [x] Task 7 — Verification gate (AC: 13)
  - [x] `bun test apps/api`
  - [x] `bun test packages/schema` (after NOT_IMPLEMENTED)
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Wire **request-id** propagation and replace every ad-hoc API error object in `apps/api` with the canonical AD-11 envelope from `@usetagih/schema`. Auth behavior from Stories 3.3–3.5 stays intact; only error transport standardizes. Success bodies stay flat.

### Binding ratified sources

| Ref | Requirement for 3.6 |
| --- | --- |
| **AD-11** | `{ error: { code, message, requestId, details[] } }`; one code → one HTTP status |
| **NFR-7** | Predictable client error handling; no bare string errors |
| **NFR-5** | Cross-workspace denial → 404 `NOT_FOUND` |
| **PRD §10.3** | Envelope shape + HTTP mapping table |
| **correct-course directive #5** | Strengthened ACs: framework validation, unknown routes, internal errors all use envelope; consume schema builders; replace auth mount, workspace-guard, stub 501 shapes |
| **Story 3.5** | Bearer chain (JWT + API key) complete — unify errors only |
| **Story 2.3** | `buildApiErrorEnvelope`, `getHttpStatusForErrorCode`, `zodIssuesToDetails` — **reuse, do not duplicate** |

### Scope boundary: 3.6 vs 3.7 vs 3.8

| Capability | Owner | 3.6 delivers |
| --- | --- | --- |
| `requestId` generation + header | **3.6** | Middleware + envelope field |
| Unified error envelope on `/v1/*` | **3.6** | All error paths |
| `NOT_IMPLEMENTED` schema code + 501 stubs | **3.6** | Extend ERROR_CODES |
| OpenAPI / Scalar / OTel / evlog | **3.7** | Do not add deps |
| `POST /v1/{documentType}/validate` route | **3.8–3.9** | Do not implement |
| Success body wrapping | **never** | Flat JSON per PRD |

### Evidence-based decisions (no human loop)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Request ID format | `req_${crypto.randomUUID()}` | ARCHITECTURE-SPINE `req_` prefix; no ulid package in monorepo; UUID acceptable at MVP |
| Response header | `X-Request-Id` | Industry standard; epics require header + envelope — name not specified elsewhere |
| Inbound propagation | Reuse valid `req_<uuid>` | Supports future proxy/tracing; generate if absent/invalid |
| `NOT_IMPLEMENTED` code | Add to `@usetagih/schema` with HTTP 501 | Stubs require 501 + `buildApiErrorEnvelope`; literal string violates AD-11; PRD table silent on 501 — intentional Epic 3 stub extension |
| Internal error message | Fixed generic string | AC forbids stack/internal message leakage in production-shaped responses |
| better-auth `/api/auth/*` errors | Out of scope unless trivial | Epics target `/v1` + listed files; plugin HTML/redirect errors differ |
| Central helper location | `apps/api/src/lib/api-error.ts` | Single assembly point; macros/routes call helper — schema stays transport-agnostic |
| Logging real 500 cause | `console.error` until 3.7 | evlog not wired yet; must not appear in response body |

**Board-awareness flag (non-blocking):** `NOT_IMPLEMENTED` + HTTP 501 extends PRD §10.3 table for Epic 3 stub routes only; remove or repurpose when stubs replaced by real handlers.

### Current state — files with ad-hoc `{ error: { code, message } }` (must migrate)

| File | Error codes used today | Notes |
| --- | --- | --- |
| `apps/api/src/auth/mount.ts` | `UNAUTHORIZED` | better-auth plugin macro |
| `apps/api/src/middleware/workspace-guard.ts` | `UNAUTHORIZED`, `WORKSPACE_REQUIRED` | session-only macro |
| `apps/api/src/middleware/auth-resolver.ts` | `UNAUTHORIZED`, `WORKSPACE_REQUIRED` | bearer + session |
| `apps/api/src/middleware/scope-guard.ts` | `UNAUTHORIZED`, `FORBIDDEN` | scope macro |
| `apps/api/src/middleware/session-management-auth.ts` | `FORBIDDEN` | api-key blocked from key CRUD |
| `apps/api/src/routes/v1/api-keys.ts` | `VALIDATION_FAILED`, `FORBIDDEN`, `NOT_FOUND` | includes local `validationFailed()` |
| `apps/api/src/routes/auth/sign-up-with-workspace.ts` | `IDEMPOTENCY_CONFLICT`, dynamic better-auth codes | map plugin codes to schema codes |
| `apps/api/src/routes/v1/session.token.ts` | `FORBIDDEN`, `UNAUTHORIZED` | CSRF failures |
| `apps/api/src/routes/v1/renders.stub.ts` | `NOT_IMPLEMENTED` (non-schema literal) | HTTP 501 |
| `apps/api/src/routes/v1/audit.stub.ts` | `NOT_IMPLEMENTED` | HTTP 501 |
| `apps/api/src/routes/v1/webhooks.stub.ts` | `NOT_IMPLEMENTED` | HTTP 501 |

**Preserve:** route mounting order in `apps/api/src/app.ts` — api-keys before stubs; middleware order inside `/v1`: cors → workspace → auth → scope → routes.

### Request-id middleware (encode exactly)

**File:** `apps/api/src/middleware/request-id.ts`

```typescript
const REQUEST_ID_HEADER = "X-Request-Id";
const REQUEST_ID_PATTERN = /^req_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createRequestId() {
  return `req_${crypto.randomUUID()}`;
}

// Elysia plugin: derive requestId → store on context → set response header on all responses
```

Wire with `.use(createRequestIdPlugin())` as **first** `.use()` on root `Elysia` in `createApp`.

### API error helper (encode exactly)

**File:** `apps/api/src/lib/api-error.ts`

```typescript
import {
  buildApiErrorEnvelope,
  getHttpStatusForErrorCode,
  type ApiErrorDetail,
  type ErrorCode,
} from "@usetagih/schema";

export function respondApiError(options: {
  set: { status?: number | string };
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: readonly ApiErrorDetail[];
}) {
  const status = getHttpStatusForErrorCode(options.code);
  options.set.status = status;
  return buildApiErrorEnvelope({
    code: options.code,
    message: options.message,
    requestId: options.requestId,
    details: options.details,
  });
}
```

Macros receiving `status(code, body)` from Elysia should migrate to `respondApiError` + `return` pattern, or a wrapper `statusApiError(statusFn, …)` that preserves macro ergonomics.

### Validation error mapping (encode exactly)

On Zod/Elysia validation failure:

```typescript
import { VALIDATION_FAILED_CODE, zodIssuesToDetails } from "@usetagih/schema";

// zodError instanceof ZodError →
respondApiError({
  code: VALIDATION_FAILED_CODE,
  message: "Request validation failed",
  requestId,
  details: zodIssuesToDetails(zodError),
  set,
});
```

Use `getHttpStatusForErrorCode(VALIDATION_FAILED_CODE)` → 422.

### Stub 501 pattern (encode exactly)

```typescript
import { NOT_IMPLEMENTED_CODE } from "@usetagih/schema";

return respondApiError({
  code: NOT_IMPLEMENTED_CODE,
  message: "Render list lands in Story 3.12", // keep story-specific message
  requestId,
  set,
});
// status 501 from getHttpStatusForErrorCode(NOT_IMPLEMENTED_CODE)
```

### Internal / unknown route (encode exactly)

| Case | Code | HTTP | Message | details |
| --- | --- | --- | --- | --- |
| No matching `/v1` route | `NOT_FOUND` | 404 | e.g. `"Route not found"` | `[]` |
| Unhandled exception | `INTERNAL_ERROR` | 500 | `"An internal error occurred"` (fixed) | `[]` |

### Previous story intelligence (3.5)

- Bearer disambiguation: JWT if token contains `.`, else API key — **do not change**
- Session-only guard on `/v1/api-keys` — **do not change**; only error shape
- Scope-parity matrix: 5 stub routes return 501 when scoped — tests assert status only today; add envelope assertions
- Integration tests use `probeDb()` skip when postgres unavailable — preserve pattern
- `@ts-nocheck` on stub route files due to Elysia macro inference — may remain
- Epic 2 open action items apply: OpenAPI structural tests must update atomically with `NOT_IMPLEMENTED` code addition

### Git intelligence (baseline 740a720)

Recent Epic 3 commits merged API key CRUD (#4), session bearer (#3), better-auth (#2). Patterns established:

- `createApp(deps)` factory with injectable repos/env for tests
- Middleware as named Elysia plugins (`createAuthResolver`, `createScopeGuard`, …)
- Integration tests under `apps/api/src/integration/`
- Schema constants imported from `@usetagih/schema` (e.g. `WORKSPACE_REQUIRED_CODE`)

### Project structure notes

```
apps/api/src/
├── lib/
│   └── api-error.ts          # NEW — envelope helper
├── middleware/
│   ├── request-id.ts         # NEW
│   ├── auth-resolver.ts      # UPDATE — use helper
│   ├── workspace-guard.ts    # UPDATE
│   ├── scope-guard.ts        # UPDATE
│   └── session-management-auth.ts  # UPDATE
├── auth/
│   └── mount.ts              # UPDATE
└── routes/
    ├── auth/sign-up-with-workspace.ts  # UPDATE
    └── v1/
        ├── api-keys.ts       # UPDATE
        ├── session.token.ts  # UPDATE
        ├── *.stub.ts         # UPDATE

packages/schema/src/errors/
├── codes.ts                  # UPDATE — NOT_IMPLEMENTED
└── http-status.ts            # UPDATE — 501 mapping
```

### Testing requirements

**Unit (`apps/api/src/middleware/error-envelope.test.ts`):**

- `respondApiError` returns strict envelope parseable by `ApiErrorEnvelopeSchema`
- `getHttpStatusForErrorCode` used for status — no hardcoded magic numbers in helper
- Validation mapping produces non-empty `details` for invalid JSON body

**Integration (extend existing files + new cases):**

- 401 on unauthenticated `GET /v1/renders`: `body.error.requestId` matches header `X-Request-Id`; `body.error.details` is array (possibly empty)
- 404 cross-workspace api-key delete: full envelope
- `GET /v1/unknown-route-xyz`: 404 `NOT_FOUND`
- Authenticated `GET /v1/renders`: still 501; `error.code === "NOT_IMPLEMENTED"`; envelope complete
- Internal error: use test-only plugin or mock — response body must not contain `"stack"` or `Error.stack` substring

**Schema (`packages/schema`):**

- `NOT_IMPLEMENTED` in `ERROR_CODES`; `getHttpStatusForErrorCode("NOT_IMPLEMENTED") === 501`
- OpenAPI/code enumeration tests updated if present

### Verification (required)

- Unit tests: `bun test apps/api` and `bun test packages/schema`
- Workspace gate: `bunx turbo run lint typecheck test build --force` from repo root (always `--force`)
- Generated artifacts: if OpenAPI generation emits outputs, update `turbo.json` outputs + biome exclude per Epic 2 action items

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.6 ACs (post directive #5)]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-11, naming conventions]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — §10.3 Error envelope]
- [Source: `packages/schema/src/errors/envelope.ts` — `buildApiErrorEnvelope`]
- [Source: `packages/schema/src/errors/http-status.ts` — `getHttpStatusForErrorCode`]
- [Source: `packages/schema/src/errors/detail.ts` — `zodIssuesToDetails`]
- [Source: `_bmad-output/implementation-artifacts/3-5-api-key-create-list-and-revoke-endpoints.md` — auth chain, deferred envelope note]
- [Source: `_bmad-output/implementation-artifacts/2-3-error-codes-enum-and-api-error-envelope-types.md` — schema error module layout]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

- Elysia macro `resolve` does not inherit `derive` context; `getRequestId(request)` via WeakMap stabilizes id across macros and handlers
- macro early-return via `status()` skips `onAfterHandle`; `set.headers` before `status()` sets `X-Request-Id`

### Completion Notes List

- Added `NOT_IMPLEMENTED` schema code mapped to HTTP 501 for Epic 3 stub routes
- Wired global request-id plugin first in `createApp()` with `req_` prefix and inbound header propagation
- Centralized `/v1` errors through `respondApiError` / `statusApiError` and `createV1ErrorHandler` (404, 422 validation, 500 internal)
- Migrated all listed ad-hoc error paths; validation failures on api-keys now return 422 with `details`
- Integration tests assert envelope shape, header/body `requestId` parity, unknown route 404, and masked 500
- `bunx turbo run lint typecheck test build --force`: 36/36 tasks green; api 130 tests, schema 64 tests

### File List

- `packages/schema/src/errors/codes.ts`
- `packages/schema/src/errors/codes.test.ts`
- `packages/schema/src/errors/http-status.ts`
- `packages/schema/src/index.ts`
- `apps/api/src/lib/api-error.ts`
- `apps/api/src/middleware/request-id.ts`
- `apps/api/src/middleware/request-id.test.ts`
- `apps/api/src/middleware/v1-error-handler.ts`
- `apps/api/src/middleware/error-envelope.test.ts`
- `apps/api/src/app.ts`
- `apps/api/src/auth/mount.ts`
- `apps/api/src/middleware/auth-resolver.ts`
- `apps/api/src/middleware/workspace-guard.ts`
- `apps/api/src/middleware/scope-guard.ts`
- `apps/api/src/middleware/session-management-auth.ts`
- `apps/api/src/routes/auth/sign-up-with-workspace.ts`
- `apps/api/src/routes/v1/api-keys.ts`
- `apps/api/src/routes/v1/session.token.ts`
- `apps/api/src/routes/v1/renders.stub.ts`
- `apps/api/src/routes/v1/audit.stub.ts`
- `apps/api/src/routes/v1/webhooks.stub.ts`
- `apps/api/src/integration/auth.integration.test.ts`
- `apps/api/src/integration/api-keys.integration.test.ts`
- `apps/api/src/routes/v1/session.token.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-6-auth-middleware-request-id-and-unified-error-envelope.md`

## Change Log

- 2026-07-20: Story 3.6 — request-id middleware, AD-11 error envelope on `/v1`, `NOT_IMPLEMENTED` 501 stubs
