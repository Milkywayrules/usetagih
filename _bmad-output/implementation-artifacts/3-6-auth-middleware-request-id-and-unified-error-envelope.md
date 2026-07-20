---
baseline_commit: 740a720
created: 2026-07-20
---

# Story 3.6: Auth middleware, request-id, and unified error envelope

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an API consumer,
I want Bearer auth middleware and consistent errors on all routes,
so that integration is predictable (NFR-7, AD-11, NFR-5).

## Acceptance Criteria

1. **Given** the Elysia `/v1` middleware chain, **when** any `/v1/*` route is hit, **then** a global request-id middleware runs first — derives `requestId` from inbound `X-Request-Id` when present and valid, otherwise generates a new id with **`req_` prefix** — stores it on request context, sets response header `X-Request-Id`, and makes it available to all downstream handlers and error paths.
2. **Given** any `/v1/*` error response (auth, scope, validation, not-found, stub 501, internal), **when** the body is JSON, **then** it matches PRD §10.3 / AD-11 shape `{ error: { code, message, requestId, details[] } }` built **exclusively** via `@usetagih/schema` helpers `buildApiErrorEnvelope` and `getHttpStatusForErrorCode` — **no** hand-rolled `{ error: { code, message } }` objects remain in `apps/api`.
3. **Given** Elysia/Zod route validation failure on a `/v1/*` route, **when** the framework rejects input, **then** HTTP status is **422**, code is `VALIDATION_FAILED`, `details[]` is populated via `zodIssuesToDetails`, and `requestId` matches the middleware value.
4. **Given** `GET /v1/does-not-exist` (unknown route under `/v1`), **when** no handler matches, **then** HTTP **404**, code `NOT_FOUND`, generic safe message (no path echo leakage beyond what Elysia already exposes), full envelope with `requestId`.
5. **Given** an unhandled thrown error inside a `/v1/*` handler, **when** `onError` runs, **then** HTTP **500**, code `INTERNAL_ERROR`, message is a stable generic string (never raw `Error.message` / stack in the JSON body), `details` is `[]`, and stack traces are **not** included in the response body.
6. **Given** production-shaped error responses, **when** inspected, **then** no stack traces or internal exception strings leak in JSON; dev logging may still record the underlying error server-side (Story 3.7 evlog wiring — do not add evlog here).
7. **Given** inline ad-hoc error returns today, **when** Story 3.6 completes, **then** all are replaced with envelope helpers — **must include**: `apps/api/src/auth/mount.ts`, `apps/api/src/middleware/workspace-guard.ts`, `apps/api/src/middleware/auth-resolver.ts`, `apps/api/src/middleware/scope-guard.ts`, `apps/api/src/middleware/session-management-auth.ts`, `apps/api/src/routes/v1/renders.stub.ts`, `apps/api/src/routes/v1/webhooks.stub.ts`, `apps/api/src/routes/v1/audit.stub.ts`, `apps/api/src/routes/v1/session.token.ts`, `apps/api/src/routes/v1/api-keys.ts`, and validation/auth branches in `apps/api/src/routes/auth/sign-up-with-workspace.ts`.
8. **Given** successful `/v1/*` responses (201 api-keys, 200 session token, 501 stub success path is still an error — see AC 9), **when** body is success JSON, **then** bodies remain **flat** — no `{ data: ... }` wrapper; standardization applies to **errors only**.
9. **Given** scope-gated stub routes (`GET|POST /v1/renders`, webhooks, audit stubs), **when** authenticated with valid scope, **then** HTTP **501** with code `NOT_IMPLEMENTED` (added to `@usetagih/schema` `ERROR_CODES` → HTTP **501** mapping), message unchanged from Story 3.3 stubs, full envelope including `requestId` and empty `details`.
10. **Given** API key Bearer and session Bearer (Story 3.4/3.5 chain), **when** auth middleware runs, **then** both continue to authenticate via `Authorization: Bearer` — this story **does not** change bearer resolution logic, only error shape + requestId propagation.
11. **Given** cross-workspace resource access (NFR-5), **when** a resource belongs to another workspace, **then** HTTP **404** with code `NOT_FOUND` — not **403**; existing Story 3.5 DELETE `/v1/api-keys/{keyId}` behavior must remain 404 for foreign keys.
12. **Given** `bun test apps/api`, **when** error-envelope test suite runs, **then** tests prove: 401 `UNAUTHORIZED`, 403 `FORBIDDEN` / `WORKSPACE_REQUIRED`, 404 `NOT_FOUND`, validation envelope with `details`, unknown-route envelope, internal-error envelope without stack/`Error.message` leakage, and `X-Request-Id` header parity with body `error.requestId` on sampled routes.
13. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
14. **Out of scope (later Epic 3 stories):** OpenAPI publish + Scalar UI (Story 3.7); evlog structured logging + OTel (Story 3.7); rate limits (Story 3.16); `POST /v1/{documentType}/validate` route (Story 3.9); changing bearer/JWT/API-key crypto logic (Stories 3.4–3.5); HSTS (Story 8.7).

## Tasks / Subtasks

- [ ] Task 1 — Extend schema for stub 501 code (AC: 2, 9)
  - [ ] Add `NOT_IMPLEMENTED` to `packages/schema/src/errors/codes.ts` and `ERROR_CODES` array
  - [ ] Map `NOT_IMPLEMENTED` → **501** in `packages/schema/src/errors/http-status.ts`
  - [ ] Update `packages/schema/src/errors/codes.test.ts` and `http-status` coverage if present
  - [ ] Regenerate/export remains via `packages/schema/src/index.ts` (no OpenAPI regen required — Story 7.4)
- [ ] Task 2 — Request-id middleware (AC: 1)
  - [ ] Create `apps/api/src/middleware/request-id.ts` — derive or generate `req_*`, set `X-Request-Id`, expose `requestId` on context
  - [ ] Wire as **first** plugin inside `/v1` group in `apps/api/src/app.ts` (before CORS/workspace/auth)
- [ ] Task 3 — Central error helpers (AC: 2, 3, 4, 5)
  - [ ] Create `apps/api/src/lib/api-error.ts` — thin wrappers: `apiError(statusCode, { code, message, requestId, details? })` calling `buildApiErrorEnvelope` + `getHttpStatusForErrorCode` guard
  - [ ] Create `apps/api/src/middleware/error-envelope.ts` — Elysia plugin with `.onError` for `/v1` group: map validation → 422, not found → 404, unknown → 500 envelope
  - [ ] Map Zod validation issues via `zodIssuesToDetails` from `@usetagih/schema`
- [ ] Task 4 — Replace ad-hoc errors across middleware/routes (AC: 6, 7, 10, 11)
  - [ ] Refactor listed files to use `apiError` helper with `requestId` from context
  - [ ] Ensure macro `status()` returns use helper — avoid duplicate envelope assembly
  - [ ] Preserve existing HTTP status semantics (401/403/404/501) — only shape changes
- [ ] Task 5 — Update integration/unit tests (AC: 12)
  - [ ] Create `apps/api/src/middleware/error-envelope.test.ts` — unit cases for validation mapping, generic internal message
  - [ ] Extend `apps/api/src/integration/auth.integration.test.ts` — assert `error.requestId`, `error.details`, header parity on 401/403/501
  - [ ] Update `session.token.test.ts`, `api-keys.integration.test.ts`, `session-token.integration.test.ts` — envelope fields on error assertions (keep behavioral expectations)
  - [ ] Add unknown-route test: `GET /v1/__missing__` → 404 envelope
  - [ ] Add internal-error test via controlled throw route in test file only (not production route)
- [ ] Task 6 — Verification gate (AC: 13)
  - [ ] `bun test apps/api`
  - [ ] `bun test packages/schema`
  - [ ] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Wire **global request-id** and **AD-11 unified error envelope** on every `/v1/*` route. Story 3.4/3.5 delivered bearer auth, scope guards, and API keys with minimal `{ error: { code, message } }` shapes — this story centralizes envelope assembly so Story 3.7 (OpenAPI, evlog, OTel) and Story 3.9+ feature routes inherit one pattern.

### Binding ratified sources

| Ref | Requirement for 3.6 |
| --- | --- |
| **NFR-7** | Unified error envelope on all endpoints |
| **NFR-5** | Cross-workspace access → **404** not 403 |
| **AD-11** | `{ error: { code, message, requestId, details[] } }`; one code → one HTTP status |
| **PRD §10.3** | Envelope shape + HTTP mapping table |
| **ARCHITECTURE-SPINE** | `requestId` prefix `req_`; naming conventions |
| **SOLUTION-DESIGN §6** | `apps/api/src/middleware/request-id` placement |
| **correct-course directive #5** | Strengthened Story 3.6 ACs — framework validation, unknown routes, internal errors via schema builders; replace auth mount / workspace-guard / stub envelopes |
| **Story 3.5** | Bearer + scope chain complete; envelope deferred explicitly |
| **Story 2.3** | `buildApiErrorEnvelope`, `getHttpStatusForErrorCode`, `zodIssuesToDetails`, `ApiErrorEnvelopeSchema` |

### Scope boundary: 3.6 vs 3.7 vs 3.9

| Capability | Owner | 3.6 delivers |
| --- | --- | --- |
| Request-id middleware + `X-Request-Id` | **3.6** | First middleware in `/v1` group |
| Unified error envelope on `/v1/*` | **3.6** | All errors via schema builders |
| Replace ad-hoc `{ error: { code, message } }` | **3.6** | Listed middleware + routes |
| `NOT_IMPLEMENTED` → 501 for stubs | **3.6** | Schema enum extension |
| evlog / OTel / OpenAPI platform baseline | **3.7** | Do not add deps or plugins |
| Validate/render HTTP routes | **3.9+** | Only envelope plumbing |

### Current state (baseline `740a720`) — files with ad-hoc errors

Every `/v1` error today omits `requestId` and `details`:

| File | Current pattern | Target codes |
| --- | --- | --- |
| `middleware/auth-resolver.ts` | `status(401\|403, { error: { code, message } })` | `UNAUTHORIZED`, `WORKSPACE_REQUIRED` |
| `middleware/workspace-guard.ts` | same | `UNAUTHORIZED`, `WORKSPACE_REQUIRED` |
| `middleware/scope-guard.ts` | `FORBIDDEN` insufficient scope | `FORBIDDEN` |
| `middleware/session-management-auth.ts` | `FORBIDDEN` session-only | `FORBIDDEN` |
| `auth/mount.ts` | `UNAUTHORIZED` on auth macro | `UNAUTHORIZED` |
| `routes/v1/*.stub.ts` | `NOT_IMPLEMENTED` literal (not in schema yet) | `NOT_IMPLEMENTED` + 501 |
| `routes/v1/session.token.ts` | ad-hoc CSRF/auth errors | `FORBIDDEN`, `UNAUTHORIZED` |
| `routes/v1/api-keys.ts` | ad-hoc validation/not-found | `VALIDATION_FAILED`, `NOT_FOUND`, etc. |
| `routes/auth/sign-up-with-workspace.ts` | Zod + better-auth API errors | map to envelope |

**Preserve:** HTTP status codes and business messages already asserted in integration tests unless AC requires generic internal messages only for 500.

### Request-id middleware (encode exactly)

```typescript
// apps/api/src/middleware/request-id.ts (sketch — implement cleanly)
const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PREFIX = "req_";

export function generateRequestId(): string {
  return `${REQUEST_ID_PREFIX}${crypto.randomUUID()}`;
}

export function normalizeInboundRequestId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith(REQUEST_ID_PREFIX) || trimmed.length > 128) return null;
  return trimmed;
}
```

**Behavior:**

- Read `X-Request-Id` (case-insensitive per fetch/HTTP conventions).
- Accept inbound only when it already has `req_` prefix (prevent log injection / unbounded values).
- Otherwise generate fresh id.
- Set response header `X-Request-Id` on every `/v1` response (success and error).
- Store as `requestId` on Elysia context for macros/handlers.

**Do not** add a new ULID dependency — `req_${crypto.randomUUID()}` satisfies prefix AC; Story 3.7 may upgrade format when evlog correlation lands.

### Central error helper (encode exactly)

```typescript
import {
  buildApiErrorEnvelope,
  getHttpStatusForErrorCode,
  type ApiErrorDetail,
  type ErrorCode,
} from "@usetagih/schema";

export function apiError(
  requestId: string,
  code: ErrorCode,
  message: string,
  details: readonly ApiErrorDetail[] = [],
) {
  const status = getHttpStatusForErrorCode(code);
  const body = buildApiErrorEnvelope({ code, message, requestId, details });
  return { status, body };
}
```

Use with Elysia `set.status = status; return body` or macro `status(status, body)`.

**Forbidden:** constructing `{ error: { ... } }` literals in route/middleware files except inside `api-error.ts` / `error-envelope.ts`.

### Elysia `/v1` middleware order (after this story)

```
/v1 group:
  1. request-id          ← NEW (Story 3.6)
  2. error-envelope      ← NEW onError handler scoped to /v1
  3. v1-cors             (existing)
  4. workspace-guard     (existing)
  5. auth-resolver       (existing — Bearer + session)
  6. scope-guard         (existing)
  7. routes…
```

`error-envelope` plugin should register `onError` to catch validation/not-found/unhandled errors for routes in the group.

**Validation mapping:** when Elysia surfaces Zod/type validation failure, map to:

```typescript
apiError(requestId, VALIDATION_FAILED_CODE, "Payload failed schema validation", zodIssuesToDetails(zodError));
```

Use the PRD §10.3 exemplar message for top-level validation failures.

**Internal errors:** return message `"An internal error occurred"` (or existing project constant) — never forward `error.message` from caught exceptions to clients.

### NOT_IMPLEMENTED schema extension

Story 3.3 introduced stub routes returning literal `"NOT_IMPLEMENTED"` string **outside** `ERROR_CODES`. Add it now:

```typescript
// codes.ts
export const NOT_IMPLEMENTED_CODE = "NOT_IMPLEMENTED" as const;
// append to ERROR_CODES array

// http-status.ts
NOT_IMPLEMENTED: 501,
```

Update OpenAPI structural tests only if they assert exhaustive enum — run `bun test packages/schema`.

### Success body shape (do not change)

Examples that must stay flat:

- `POST /v1/api-keys` 201 → `{ id, name, prefix, secret, scopes, ... }`
- `POST /v1/session/token` 200 → `{ accessToken, tokenType, expiresIn, scopes, workspaceId }`
- `GET /v1/api-keys` 200 → `{ keys: [...] }`

Only error responses use the envelope.

### NFR-5 cross-workspace

Story 3.5 already returns 404 for foreign `keyId`. Verify envelope wraps same behavior — **do not** downgrade to 403. Add regression assertion in api-keys integration test if missing `requestId` checks.

### Previous story intelligence (3.5)

- Integration harness: `createApp({ db })`, `probeDb()` skip pattern, `extractCookies`, sign-up-with-workspace helper — reuse for envelope tests.
- Scope-parity matrix in `session.token.test.ts` — update error assertions to include `requestId` + `details: []` without changing grant/deny matrix logic.
- `@node-rs/argon2`, `bearer-auth.ts` JWT-vs-api-key disambiguation — **do not modify** in 3.6.
- Story 3.5 explicitly deferred envelope — replacing ad-hoc shapes is **in scope now**.

### Git intelligence (recent Epic 3 commits)

| Commit | Relevance |
| --- | --- |
| `740a720` | Story 3.5 merged — api-keys routes, bearer extension, scope matrix |
| `3bf4ed8` | Story 3.5 done — current middleware chain stable |
| `feat/story-3-4-*` | Session token + CSRF + scope guard macros |

### Testing requirements

**Unit (`apps/api/src/middleware/error-envelope.test.ts`):**

- `buildApiErrorEnvelope` output validates against `ApiErrorEnvelopeSchema`
- Validation error maps to 422 + non-empty `details[].path`
- Internal handler returns 500 without stack keys in JSON

**Integration (extend existing files + new cases):**

- 401 on `GET /v1/renders` → `error.requestId` matches `X-Request-Id` header
- 403 `WORKSPACE_REQUIRED` → full envelope
- 501 stub → `NOT_IMPLEMENTED` + `requestId`
- `GET /v1/unknown-path-xyz` → 404 `NOT_FOUND`
- Trigger controlled 500 via test-only plugin route inside test file

**Do not** weaken existing auth/session/api-key behavioral tests — add envelope field assertions.

### Verification (required)

- Unit tests: `bun test apps/api` and `bun test packages/schema`
- Workspace gate: `bunx turbo run lint typecheck test build --force` from repo root (always `--force`)
- Postgres optional: integration tests skip via `probeDb()` when compose unavailable

### Project Structure Notes

- New files under `apps/api/src/middleware/` and `apps/api/src/lib/` per SOLUTION-DESIGN layout
- Schema change confined to `packages/schema/src/errors/` — no changes to document payload validators
- No new npm dependencies expected

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 3.6]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md` — AD-11, naming]
- [Source: `_bmad-output/planning-artifacts/prds/prd-usetagih-2026-07-20/prd.md` — §10.3]
- [Source: `packages/schema/src/errors/envelope.ts` — `buildApiErrorEnvelope`]
- [Source: `packages/schema/src/errors/http-status.ts` — `getHttpStatusForErrorCode`]
- [Source: `packages/schema/src/errors/detail.ts` — `zodIssuesToDetails`]
- [Source: `_bmad-output/implementation-artifacts/3-5-api-key-create-list-and-revoke-endpoints.md` — deferred envelope note]
- [Source: `_bmad-output/implementation-artifacts/3-4-post-v1-session-token-short-lived-audience-bound-csrf-protected-bearer.md` — middleware order baseline]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
