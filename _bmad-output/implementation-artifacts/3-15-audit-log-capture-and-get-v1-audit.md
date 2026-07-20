---
baseline_commit: 10c513c
created: 2026-07-20
---

# Story 3.15: Audit log capture and GET /v1/audit

Status: done

## Story

As a workspace owner,
I want append-only audit trail queryable via API,
So that embed flows are accountable (FR-27, NFR-11, AD-7).

## Acceptance Criteria

1. **Given** mutating operations: login, api_key create/revoke, validate, render, download, share revoke, **when** each completes, **then** `audit_events` row with actor, action, resource id, timestamp, IP for API, outcome.
2. **And** `GET /v1/audit?page&pageSize` returns paginated last 90 days with `audit:read` scope.
3. **And** no DELETE on `audit_events` at MVP.
4. **And** bun test verifies append-only behavior.
5. **Given** docker compose postgres + `bunx turbo run lint typecheck test build --force`, **then** all tasks exit 0.

## Tasks / Subtasks

- [x] Task 1 — Core: extend `AuditRepo` with `listByWorkspacePaginated`; `listAuditUseCase` with 90-day retention
- [x] Task 2 — DB: implement paginated workspace query in `createAuditRepo`
- [x] Task 3 — API: replace audit stub with `GET /v1/audit`; wire audit capture on validate, render, share revoke
- [x] Task 4 — Unit + integration tests; session.token scope parity update
- [x] Task 5 — Verification gate: docker postgres + turbo 36/36
- [x] Task 6 — PR, merge, adversarial review

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (implementation subagent)

### Completion Notes

- Extended capture to `validate`, `render`, and `share.revoke`; login, api_key create/revoke, and `render.download` were already wired in Stories 3.3–3.13.
- `GET /v1/audit` returns `{ events, page, pageSize, total }` with 90-day retention enforced in `listAuditUseCase`.
- API-key auth resolves audit actor via workspace owner (`resolveAuditUserId`) with `apiKeyId` in metadata.
- Merged via PR #33.

### Adversarial code review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.15 audit log capture)  
**Verdict:** no medium+ findings — status → done

| ID | Severity | Disposition | Finding | Notes |
| --- | --- | --- | --- | --- |
| CR-1 | low | dismiss | Login/signup events (`workspaceId: null`) excluded from workspace-scoped list | Expected — workspace audit list is tenant-scoped |
| CR-2 | low | defer | Validate failure audit lacks error code in metadata | Outcome field captures success/failure; detail enrichment deferred |
| CR-3 | low | dismiss | API-key actor still workspace owner, not key holder | Same MVP model as Story 3.13; `apiKeyId` preserved in metadata |

### File List

- packages/core/src/ports/audit-repo.ts
- packages/core/src/use-cases/list-audit-use-case.ts
- packages/core/src/use-cases/list-audit-use-case.test.ts
- packages/db/src/repositories/audit-repo.ts
- packages/db/src/repositories/audit-repo.test.ts
- apps/api/src/routes/v1/audit.ts
- apps/api/src/routes/v1/audit.schemas.ts
- apps/api/src/routes/v1/audit.test.ts
- apps/api/src/routes/v1/validate-by-document-type.ts
- apps/api/src/routes/v1/render-by-document-type.ts
- apps/api/src/routes/v1/renders.ts
- apps/api/src/app.ts
- apps/api/src/test-helpers/audit.ts
- apps/api/src/routes/v1/session.token.test.ts
- apps/api/src/routes/v1/validate-by-document-type.test.ts
- apps/api/src/routes/v1/render-by-document-type.test.ts
- apps/api/src/routes/v1/renders.test.ts
- packages/schema/src/guard/no-duplicate-zod.test.ts
