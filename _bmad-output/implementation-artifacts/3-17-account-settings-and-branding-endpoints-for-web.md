---
baseline_commit: 0028238
created: 2026-07-20
---

# Story 3.17: Workspace settings and branding endpoints for web

Status: done

## Story

As a direct user,
I want PATCH business/branding settings and logo upload,
So that PDFs use my identity (PRD §10.1 branding, UX-DR13).

## Acceptance Criteria

1. **Given** authenticated session token or API key scoped to active workspace with `settings:write`, **when** `PATCH /v1/settings/business`, **then** `workspace_settings.business_identity` is merged and returned.
2. **Given** authenticated session token or API key with `settings:write`, **when** `PATCH /v1/settings/branding`, **then** `workspace_settings.branding` is merged (logoUrl HTTPS-only, accentColor hex).
3. **Given** authenticated session token or API key with `settings:write`, **when** `POST /v1/settings/branding/logo` with multipart `logo` file, **then** logo bytes pass same size/magic/SVG rules as Story 3.10; blob stored; branding `logoUrl` updated to stable HTTPS reference.
4. **Given** render/preview path, **when** payload omits branding logo, **then** workspace default branding is used; payload branding overrides workspace (merge precedence).
5. **Given** bun test, **when** settings + merge tests run, **then** merge precedence payload override > workspace default is covered.
6. **Given** docker compose postgres + minio + `bunx turbo run lint typecheck test build --force`, **then** all tasks exit 0.

## Tasks / Subtasks

- [x] Task 1 — Schema: `BusinessIdentitySchema`, `UpdateBrandingBodySchema`, `settings:write` scope + ROUTE_SCOPE_REQUIREMENTS
- [x] Task 2 — Render: `ingestLogoFromBytes`, `buildWorkspaceUploadedLogoUrl`
- [x] Task 3 — DB: extend `WorkspaceSettingsRepo` with update + full read
- [x] Task 4 — API: PATCH business/branding, POST logo upload; wire in app.ts
- [x] Task 5 — Tests: settings routes, repo postgres-gated, merge precedence, session scope parity
- [x] Task 6 — Verification gate: docker postgres + minio + turbo 36/36
- [x] Task 7 — PR, merge, adversarial review

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (implementation subagent)

### Completion Notes

- Added `settings:write` scope for workspace settings mutations; session tokens inherit all scopes.
- Logo upload reuses Story 3.10 byte validation via `ingestLogoFromBytes`; stored logoUrl is stable HTTPS path indexed in LogoBlobStore for render re-read without re-fetch.
- Render merge precedence unchanged in `mergeBranding` / `resolveLogoUseCase` (Story 3.10); settings tests assert payload override > workspace default.
- Merged via PR #36 (`6cf557b`).

### Adversarial code review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.17 workspace settings + branding endpoints)  
**Verdict:** no medium+ findings — status → done

| AC | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | `PATCH /v1/settings/business` merges `business_identity` jsonb via `WorkspaceSettingsRepo.updateBusinessIdentity` |
| 2 | PASS | `PATCH /v1/settings/branding` merges branding with `BrandingSchema.partial()` validation |
| 3 | PASS | `POST /v1/settings/branding/logo` uses `ingestLogoFromBytes` (2MB cap, magic sniff, SVG sanitize); `putWithUrl` + stable HTTPS logoUrl |
| 4 | PASS | Render/preview routes read workspace branding; `mergeBranding` payload wins (Story 3.10) |
| 5 | PASS | `settings.test.ts` + `resolve-logo-use-case.test.ts` cover merge precedence |
| 6 | PASS | turbo 36/36 with postgres + minio stack |

| ID | Severity | Disposition | Finding | Notes |
| --- | --- | --- | --- | --- |
| CR-1 | low | defer | Uploaded logoUrl is synthetic HTTPS path without GET handler | Render resolves via `findLogoByUrl` cache; public logo serve deferred to web/CDN story |
| CR-2 | low | dismiss | `settings:write` not in existing API keys until rotated | New scope additive; session tokens grant all scopes |
| CR-3 | low | defer | No audit events on settings mutations | MVP scope; Story 3.15 pattern can extend later |

### File List

- packages/schema/src/settings/business-identity.ts
- packages/schema/src/settings/branding-settings.ts
- packages/schema/src/auth/scopes.ts
- packages/schema/src/auth/scopes.test.ts
- packages/schema/src/index.ts
- packages/render/src/logo-ingestion/ingest-logo.ts
- packages/render/src/logo-ingestion/ingest-logo.test.ts
- packages/render/src/logo-ingestion/workspace-logo-url.ts
- packages/render/src/logo-ingestion/index.ts
- packages/render/src/index.ts
- packages/db/src/repositories/workspace-settings-repo.ts
- packages/db/src/repositories/workspace-settings-repo.test.ts
- apps/api/src/routes/v1/settings.ts
- apps/api/src/routes/v1/settings.schemas.ts
- apps/api/src/routes/v1/settings.test.ts
- apps/api/src/routes/v1/session.token.test.ts
- apps/api/src/test-helpers/workspace-settings.ts
- apps/api/src/app.ts
