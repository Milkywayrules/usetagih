---
baseline_commit: 8648313
created: 2026-07-20
---

# Story 3.14: Signed share URLs, public resolver, and revoke

Status: done

## Story

As a document recipient,
I want share links with TTL and public view/download,
So that PDFs distribute without API keys (FR-19, AD-6).

## Acceptance Criteria

1. **Given** completed render with default shareTtlDays 90 or per-render 1–365, **when** shareUrl generated, **then** HMAC-signed HTTPS URL; tampered signature fails.
2. **And** GET /v1/share/{token} public endpoint returns metadata + download redirect for SCR-SHARE-PUBLIC.
3. **And** expired token returns 403 or branded expiry JSON.
4. **And** DELETE /v1/renders/{renderId}/share revokes link; no reissue endpoint.
5. **And** bun test covers sign, verify, expiry, revoke.
6. **Given** docker compose postgres + `bunx turbo run lint typecheck test build --force`, **then** all tasks exit 0.

## Tasks / Subtasks

- [x] Task 1 — Core: `share-token` sign/verify + share use cases
- [x] Task 2 — DB: `RenderRepo.getById`, `revokeShare`
- [x] Task 3 — API: public `GET /v1/share/{token}`, `GET /v1/share/{token}/download`, `DELETE /v1/renders/{renderId}/share`
- [x] Task 4 — Env: `USETAGIH_SHARE_SIGNING_SECRET` validation
- [x] Task 5 — Unit + integration tests
- [x] Task 6 — Verification gate: docker postgres + turbo 36/36
- [x] Task 7 — PR, merge, adversarial review

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (implementation subagent)

### Completion Notes

- HMAC share tokens (`payload.signature`) stored in `share_token`; `shareTtlDays` honored from payload (default 90).
- Public routes unauthenticated; expired/revoked return 403 FORBIDDEN.
- Merged via PR #32 (`50eb652`).

### Adversarial code review (2026-07-20)

**Reviewer:** adversarial code review (Story 3.14 signed share URLs)  
**Verdict:** no medium+ findings — status → done

| ID | Severity | Disposition | Finding | Notes |
| --- | --- | --- | --- | --- |
| CR-1 | low | defer | `downloadUrl` is relative path; web must prepend API base | Matches SCR-SHARE-PUBLIC pattern; SDK can wrap in Story 6.12 |
| CR-2 | low | dismiss | No audit row on share revoke | Full audit capture deferred to Story 3.15 |
| CR-3 | low | dismiss | Revoke test in renders.test.ts mutates shared fixture state | Single test file order; acceptable for unit suite |

### File List

- packages/core/src/share-token.ts
- packages/core/src/share-token.test.ts
- packages/core/src/use-cases/resolve-share-use-case.ts
- packages/core/src/use-cases/revoke-share-use-case.ts
- packages/core/src/use-cases/share-use-case.test.ts
- packages/core/src/use-cases/render-use-case.ts
- packages/core/src/use-cases/render-metadata.ts
- packages/core/src/ports/render-repo.ts
- packages/db/src/repositories/render-repo.ts
- packages/config/src/env/schema.ts
- apps/api/src/routes/v1/share.ts
- apps/api/src/routes/v1/share.test.ts
- apps/api/src/routes/v1/renders.ts
- apps/api/src/app.ts
- packages/schema/src/auth/scopes.ts
- apps/api/src/integration/render-retrieval.integration.test.ts
