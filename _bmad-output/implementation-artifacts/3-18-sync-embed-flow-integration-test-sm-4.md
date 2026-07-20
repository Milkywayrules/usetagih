---
baseline_commit: a8d0234
created: 2026-07-20
---

# Story 3.18: Sync embed flow integration test (SM-4)

Status: done

## Story

As a QA engineer,
I want staging-style integration test validate→render→download→share,
So that MVP embed path is proven before web (SM-4).

## Acceptance Criteria

1. **Given** docker compose stack with api+postgres+minio, **when** integration test runs validate → 200, **then** normalized preview returned.
2. **Given** same workspace API key, **when** render with `Idempotency-Key` → 201, **then** renderId and shareUrl returned.
3. **Given** retry with same idempotency key and body, **when** render again, **then** identical renderId/shareUrl without duplicate render side effects.
4. **Given** completed render, **when** authenticated download, **then** PDF bytes returned (`%PDF` header).
5. **Given** share URL from render metadata, **when** public share resolver called, **then** 200 with downloadUrl that serves PDF.
6. **Given** audit log for workspace, **when** flow completes, **then** entries exist for `validate`, `render`, and `render.download` actions.
7. **Given** bun test integration tag, **when** postgres unreachable or typst absent, **then** test suite skips gracefully.
8. **Given** docker compose postgres + minio + typst + `bunx turbo run lint typecheck test build --force`, **then** all tasks exit 0.

## Tasks / Subtasks

- [x] Task 1 — Story file + sprint status ready-for-dev
- [x] Task 2 — Implement `apps/api/tests/embed-sync-flow.test.ts` (SM-4 sync path)
- [x] Task 3 — Wire api test script to include `tests/` directory
- [x] Task 4 — Verification gate: docker postgres + minio + typst + turbo 36/36
- [x] Task 5 — Adversarial review + PR merge

## Dev Notes

- Reuse patterns from `validate.integration.test.ts`, `idempotency.integration.test.ts`, `render-retrieval.integration.test.ts`.
- Real Typst compile path (not mocked render runtime) — gated on `resolveTypstBinaryPath()`.
- Fixture: `invoice-modern-basic.json` for realistic embed payload.
- Audit actions: `validate`, `render`, `render.download` (Story 3.15).

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (implementation subagent)

### Completion Notes

- Added end-to-end SM-4 sync embed integration test covering validate → render → idempotent retry → download → public share resolver.
- Extended `@usetagih/api` test script to include `tests/` directory per story AC path.
- Verification: turbo 36/36 with postgres + minio + typst stack.
- Merged via PR #38 (`801420f`).

### Adversarial code review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.18 SM-4 sync embed flow integration test)  
**Verdict:** no medium+ findings — status → done

| AC | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | `POST /v1/invoices/validate` → 200 with `valid: true` and schemaVersion |
| 2 | PASS | `POST /v1/invoices/render` with `Idempotency-Key` → 201, `rnd_*` id, shareUrl |
| 3 | PASS | Retry returns identical JSON body (idempotency middleware) |
| 4 | PASS | Authenticated download returns PDF bytes (`0x25 0x50` header) |
| 5 | PASS | Share token resolves → public download serves `application/pdf` |
| 6 | PASS | Audit rows for `validate`, `render`, `render.download` on workspace |
| 7 | PASS | `describe.skip` when postgres down; typst-gated test + skip notice |
| 8 | PASS | turbo 36/36 with docker postgres + minio + typst |

| ID | Severity | Disposition | Finding | Notes |
| --- | --- | --- | --- | --- |
| CR-1 | low | dismiss | Single document type (invoice) only | SM-4 MVP scope; validate/render paths identical across types |
| CR-2 | low | defer | No webhook step | Sync SM-4 only; Story 4.7 covers async webhook path |

### File List

- apps/api/tests/embed-sync-flow.test.ts
- apps/api/package.json
- _bmad-output/implementation-artifacts/3-18-sync-embed-flow-integration-test-sm-4.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
