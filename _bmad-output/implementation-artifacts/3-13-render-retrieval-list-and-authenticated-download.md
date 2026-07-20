---
baseline_commit: f71c109
created: 2026-07-20
---

# Story 3.13: Render retrieval, list, and authenticated download

Status: review

## Story

As an integrator,
I want GET render metadata, paginated list, and PDF download,
So that I can retrieve artifacts after render (FR-13, FR-14, FR-15).

## Acceptance Criteria

1. **Given** completed render owned by workspace, **when** `GET /v1/renders/{renderId}` with `renders:read`, **then** HTTP **200** with metadata `{ renderId, status, documentType, template, schemaVersion, shareUrl, expiresAt, idempotencyFingerprint, createdAt, updatedAt }`.
2. **Given** workspace renders, **when** `GET /v1/renders?page&pageSize&documentType&from&to`, **then** HTTP **200** with `{ renders, page, pageSize, total }` — default `pageSize` 20, max 100; metadata only (no PDF bytes).
3. **Given** completed render with stored artifact, **when** `GET /v1/renders/{renderId}/download` with `renders:read`, **then** HTTP **200**, `Content-Type: application/pdf`, `Content-Disposition: attachment`, bytes verified against stored `sha256`.
4. **Given** successful download, **when** audit inspected, **then** `render.download` event appended with actor, resource id, IP, outcome success (FR-27 partial — download only).
5. **Given** renderId belonging to another workspace, **when** any retrieval route called, **then** HTTP **404** `NOT_FOUND` (no enumeration).
6. **Given** invalid `renderId` format, **when** detail or download called, **then** HTTP **404** `NOT_FOUND`.
7. **Given** `packages/schema/src/auth/scopes.ts`, **when** updated, **then** includes `GET /v1/renders/{renderId}`, `GET /v1/renders/{renderId}/download` → `["renders:read"]`; session.token scope parity matrix extended.
8. **Given** compose Postgres (+ Typst for render fixture), **when** integration test runs, **then** render → list → get → download round-trip passes with audit row.
9. **Given** docker compose postgres + `bunx turbo run lint typecheck test build --force`, **then** all tasks exit 0.
10. **Out of scope:** public share resolver (Story 3.14); full audit query API (Story 3.15); rate limits (Story 3.16); `POST /v1/renders` remains stub.

## Tasks / Subtasks

- [x] Task 1 — Core: `render-id` helpers + `getRenderUseCase`, `listRendersUseCase`, `downloadRenderUseCase`
- [x] Task 2 — DB: extend `RenderRepo` with paginated filtered list + count
- [x] Task 3 — API: `renders.ts` routes, query schemas; wire in `app.ts`
- [x] Task 4 — Scopes + session.token parity matrix
- [x] Task 5 — Unit + integration tests
- [x] Task 6 — Verification gate: docker postgres + turbo 36/36
- [ ] Task 7 — PR, merge, adversarial review

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (implementation subagent)

### Completion Notes

(pending)

### File List

(pending)
