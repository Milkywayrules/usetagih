---
baseline_commit: c8d7f89
created: 2026-07-20
---

# Story 3.12: Sync render path — POST /v1/{documentType}/render (≤100 items, ≤10s)

Status: done

## Story

As an integrator,
I want synchronous 201 render for standard payloads,
So that embed flow completes in one request (FR-12 sync, FR-7, NFR-1).

## Acceptance Criteria

1. **Given** payload with ≤100 line items, **when** `POST /v1/invoices/render` with `renders:write` + `Idempotency-Key`, **then** HTTP **201**, `Location: /v1/renders/{renderId}`, body `{ renderId, status: "completed", shareUrl, expiresAt, schemaVersion, documentType, template }` with `renderId` prefixed `rnd_`.
2. **Given** valid payload, **when** sync render completes, **then** PDF uploaded to artifact store at `renders/{workspaceId}/{renderId}.pdf` and `sha256` stored on render record.
3. **Given** workspace tier, **when** Typst inputs built, **then** `trial` → `tier=free` watermark; paid tiers → `tier=pro`; snapshots include `resolvedTier`, `showWatermark`, `brandingSnapshot`, `logoChecksum`, `payloadHash`.
4. **Given** invalid payload, **when** render called, **then** HTTP **422** before Typst invoked.
5. **Given** payload with >100 line items, **when** sync render called, **then** rejected with **400** `INVALID_REQUEST` at `/lineItems`.
6. **Given** compose Postgres + Typst (or mocked timing path), **when** integration test runs, **then** basic fixture completes within P95 smoke budget ≤2s.
7. **Given** render success, **when** evlog inspected, **then** structured fields include `renderId`, stage timings (`validateMs`, `typstMs`, `uploadMs`, `persistMs`, `totalMs`).
8. **Given** idempotency middleware from Story 3.8 unchanged, **when** inner handler swapped, **then** retry semantics and `rnd_` prefix assertions still pass.

## Tasks / Subtasks

- [x] Task 1 — `renderPdfFromPayload` in `packages/render` (+ typst-gated test)
- [x] Task 2 — `createMemoryArtifactStore` in `packages/db`
- [x] Task 3 — `renderUseCase` in `packages/core` (+ unit tests)
- [x] Task 4 — API wiring: `render-deps`, `map-render-result`, `render-by-document-type`
- [x] Task 5 — Replace stub in `app.ts`; export `getIdempotencyContext`
- [x] Task 6 — Route unit tests + integration tests (postgres/typst gated)
- [x] Task 7 — Verification gate: docker postgres + turbo lint typecheck test build
- [x] Task 8 — PR, CI, merge, adversarial review

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (implementation subagent)

### Completion Notes

- Swapped Story 3.8 stub inner handler for real Typst sync render pipeline without changing idempotency middleware contract.
- Default share TTL 90 days; trial tier sets `showWatermark: true`.
- Sync path rejects payloads with >100 line items at validation layer before Typst.
- Merged via PR #29 (`2d02190`).

### Adversarial code review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.12 sync render path)  
**Verdict:** no medium+ findings — status → done

| ID | Severity | Disposition | Finding | Notes |
| --- | --- | --- | --- | --- |
| CR-1 | low | defer | Typst compile failures propagate as 500 `INTERNAL_ERROR` | Same class as Story 3.11 pre-fix; structured render-stage error mapping deferred |
| CR-2 | low | dismiss | `rawBody` stored on idempotency context for handler payload parse | Required so Elysia body parser does not consume stream before idempotency hash; minimal middleware extension |
| CR-3 | low | dismiss | Production uses in-memory artifact store until R2 adapter lands | Story scope; `createMemoryArtifactStore` satisfies AC for tests/CI |
| CR-4 | low | defer | Artifact upload precedes DB insert without compensating transaction | Acceptable MVP — orphan PDF in memory store is low impact; Epic 4/production R2 can add rollback |

### File List

- packages/render/src/render-pdf-from-payload.ts
- packages/render/src/render-pdf-from-payload.test.ts
- packages/db/src/repositories/memory-artifact-store.ts
- packages/core/src/use-cases/render-use-case.ts
- packages/core/src/use-cases/render-use-case.test.ts
- apps/api/src/lib/render-deps.ts
- apps/api/src/lib/map-render-result.ts
- apps/api/src/lib/map-render-result.test.ts
- apps/api/src/routes/v1/render-by-document-type.ts
- apps/api/src/routes/v1/render-by-document-type.test.ts
- apps/api/src/integration/render.integration.test.ts
- apps/api/src/integration/idempotency.integration.test.ts (updated)
- apps/api/src/app.ts
- apps/api/src/middleware/idempotency.ts
- packages/schema/src/auth/scopes.ts
