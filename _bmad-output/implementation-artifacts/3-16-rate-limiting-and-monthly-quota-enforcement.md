---
baseline_commit: 0e43c0e
created: 2026-07-20
---

# Story 3.16: Rate limiting and monthly quota enforcement

Status: review

## Story

As a platform operator,
I want per-workspace rate limits and tier quotas,
So that abuse is controlled (FR-17, NFR-12).

## Acceptance Criteria

1. **Given** `usage_counters` tracks monthly renders per workspace tier per hypothesis table (trial 100/mo default), **when** render POST succeeds, **then** counter increments atomically for current UTC month.
2. **When** rate limit exceeded (per-tier renders/min hypothesis), **then** HTTP **429** code `RATE_LIMITED` with `Retry-After` header.
3. **When** monthly quota exceeded, **then** HTTP **402** code `QUOTA_EXCEEDED` naming current tier and next tier in message + details.
4. **Given** idempotent retry with same `Idempotency-Key`, **when** cache hit, **then** quota is not incremented again (FR-24).
5. **Given** bun test, **when** limit boundaries tested per tier enum, **then** rate and quota paths pass.
6. **Given** docker compose postgres + `bunx turbo run lint typecheck test build --force`, **then** all tasks exit 0.

## Tasks / Subtasks

- [x] Task 1 — Core: tier limit tables, `RenderLimitsService`, in-memory adapters
- [x] Task 2 — DB: `UsageCounterRepo` Drizzle adapter + postgres-gated test
- [x] Task 3 — API: wire limits into idempotency middleware on render POST; skip on cache hit
- [x] Task 4 — Unit tests: service + route 429/402/idempotency quota parity
- [x] Task 5 — Verification gate: docker postgres + turbo 36/36
- [ ] Task 6 — PR, merge, adversarial review

## Dev Agent Record

### Agent Model Used

composer-2.5-fast (implementation subagent)

### Completion Notes

- Per-tier limits from pricing hypothesis addendum: trial 100/mo @ 30/min through business 10k/mo @ 300/min.
- Rate limit uses in-memory sliding window per workspace (single-instance MVP); monthly quota persists in `usage_counters`.
- Idempotency cache hits bypass both checks and post-success increment.

### File List

- packages/core/src/tier-limits.ts
- packages/core/src/tier-limits.test.ts
- packages/core/src/ports/usage-counter-repo.ts
- packages/core/src/ports/render-rate-limiter.ts
- packages/core/src/in-memory/usage-counter-repo.ts
- packages/core/src/in-memory/render-rate-limiter.ts
- packages/core/src/services/render-limits-service.ts
- packages/core/src/services/render-limits-service.test.ts
- packages/core/src/ports/index.ts
- packages/core/src/index.ts
- packages/db/src/repositories/usage-counter-repo.ts
- packages/db/src/repositories/usage-counter-repo.test.ts
- packages/db/src/index.ts
- apps/api/src/middleware/idempotency.ts
- apps/api/src/routes/v1/render-by-document-type.ts
- apps/api/src/routes/v1/render-by-document-type.test.ts
- apps/api/src/app.ts
- apps/api/src/test-helpers/render-limits.ts
