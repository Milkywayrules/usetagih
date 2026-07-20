---
baseline_commit: 63506d0
created: 2026-07-20
---

# Story 3.1: Drizzle database schema and migrations for core tables

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a backend developer,
I want PostgreSQL tables for better-auth organization plugin, workspace_settings, api_keys, renders, idempotency_keys, audit_events, usage_counters,
so that API core can persist workspace-scoped metadata (SOLUTION-DESIGN §7, AD-6).

## Acceptance Criteria

1. **Given** `packages/db/src/schema/` with Drizzle models matching SOLUTION-DESIGN §7.1 and the column spec in Dev Notes §Table definitions, **when** `bun run --filter @usetagih/db migrate` runs against compose Postgres (`docker/compose.yml`), **then** migrations apply cleanly and all Epic 3 tables exist.
2. **Given** applied migrations, **then** tables include: better-auth core (`user`, `session`, `account`, `verification`); better-auth organization plugin (`organization`, `member`, `invitation`) with **teams disabled** (no team tables); `workspace_settings`; `api_keys`; `renders`; `idempotency_keys`; `audit_events`; `usage_counters`.
3. **Given** the ratified data model (correct-course note 7), **then** there is **no** duplicate `workspaces` table — `organization` **is** workspace identity; `workspace_settings.organization_id` PK/FK → `organization.id`; all tenant resources FK `workspace_id` → `organization.id`.
4. **Given** render records (SOLUTION-DESIGN §4.1 step 4, §4.3, AD-7), **then** `renders` includes snapshot columns `resolved_tier`, `show_watermark`, `branding_snapshot`, plus `logo_checksum` — populated at render time in later stories; schema must exist now.
5. **Given** audit semantics (correct-course note 7), **then** `audit_events.workspace_id` is nullable **only** for signup/login/bootstrap actions; all tenant-resource audit rows require non-null `workspace_id`; `user_id` actor FK → `user.id` is required.
6. **Given** Epic 3 scope boundary, **then** `webhooks` and `webhook_deliveries` tables are **not** created (deferred to Epic 4 Story 4.3).
7. **Given** `packages/db/src/repositories/render-repo.ts` with workspace-scoped queries, **when** `bun test packages/db` runs against compose Postgres, **then** cross-workspace isolation tests pass: two organizations, renders inserted per workspace, scoped `listByWorkspace` / `getByIdAndWorkspace` never return the other workspace's rows.
8. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
9. **Out of scope (later Epic 3 stories):** better-auth HTTP mount (`apps/api`), session middleware, API routes, R2 upload, Typst render, rate limits, seed data beyond optional dev helper stub, `@usetagih/config` env schema expansion beyond existing `DATABASE_URL`.

## Tasks / Subtasks

- [x] Task 1 — Dependencies + version pins (AC: 1, 8)
  - [x] Add pinned deps to `packages/db/package.json` (Dev Notes §Pinned toolchain)
  - [x] Add `@usetagih/config` workspace dependency for `DATABASE_URL` parsing
- [x] Task 2 — Auth config seam + CLI-generated better-auth schema (AC: 2, 3)
  - [x] Create `packages/db/src/auth/auth.config.ts` — minimal `betterAuth()` config for CLI only (Story 3.3 imports/extends this file)
  - [x] Run `bun run --filter @usetagih/db generate:auth-schema` → commit output to `packages/db/src/schema/better-auth.ts`
  - [x] Verify organization plugin tables present; **no** teams plugin tables
- [x] Task 3 — Hand-written app schema modules (AC: 1–6)
  - [x] Create enums + table modules per Dev Notes §Package layout
  - [x] Wire Drizzle relations in `schema/relations.ts` (required for better-auth joins in 3.3)
  - [x] Export unified schema from `schema/index.ts`
- [x] Task 4 — Drizzle Kit config + migrations (AC: 1)
  - [x] Add `packages/db/drizzle.config.ts`
  - [x] Add scripts: `generate`, `migrate`, `generate:auth-schema`
  - [x] Run `bun run --filter @usetagih/db generate` then `migrate` against compose Postgres
  - [x] Commit SQL under `packages/db/migrations/`
- [x] Task 5 — DB client + render repository (AC: 7)
  - [x] Replace stub `src/index.ts` — export `createDb`, schema, types
  - [x] Implement `src/client.ts` using `postgres` driver + `drizzle()`
  - [x] Implement `src/repositories/render-repo.ts` with workspace-scoped queries
- [x] Task 6 — Isolation tests (AC: 7)
  - [x] Create `src/isolation.test.ts` (or `render-repo.test.ts`) — two-org fixture, leak assertions
  - [x] Skip suite gracefully when Postgres unreachable (document in test header)
- [x] Task 7 — Verification gate (AC: 8)
  - [x] `docker compose -f docker/compose.yml up -d postgres` (if not running)
  - [x] `bun run --filter @usetagih/db migrate`
  - [x] `bun test packages/db`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Replace the Story 0.1 `@usetagih/db` stub with production Drizzle schema, migrations, and workspace-scoped repository primitives. Epic 3 Stories 3.2–3.18 import `@usetagih/db` — **this story owns tables and migrations only**, not auth HTTP runtime.

### Binding ratified amendments (correct-course 2026-07-20)

| Note | Requirement for 3.1 |
| --- | --- |
| **5 (A11 determinism)** | `renders.resolved_tier` + `renders.show_watermark` snapshot columns exist now; render path maps `trial` → Typst `tier=free` in Story 3.11 — do **not** rename Typst input enum in this story |
| **7 (A24/A25 data model)** | `organization` IS workspace; no `workspaces` table; render snapshot columns; nullable `audit_events.workspace_id` only for signup/login/bootstrap |

### Architecture compliance

| Ref | Rule |
| --- | --- |
| **AD-5** | `idempotency_keys` scoped by `workspace_id` + `endpoint` + SHA-256 `key_hash`; store `response_body` snapshot ≥24h |
| **AD-6** | `renders.r2_key` stores `renders/{workspaceId}/{renderId}.pdf` path pattern (populated in render stories) |
| **AD-7** | `api_keys.key_hash` argon2 at app layer (column stores hash text); cross-workspace access returns 404 at API layer — repo must require `workspace_id` filter |
| **ARCHITECTURE-SPINE IDs** | PostgreSQL `uuid` PKs internally; API `rnd_`/`key_`/`req_` prefixes added in Epic 3 route layer — DB uses raw uuid |

### Pinned toolchain (exact pins — no guessing)

| Package | Pin | Rationale |
| --- | --- | --- |
| `better-auth` | `1.6.23` | ARCHITECTURE-SPINE "better-auth 1.x"; latest stable 1.x at story creation |
| `@better-auth/cli` | `1.6.23` | Must match `better-auth` for schema generation; uses `better-auth/adapters/drizzle` subpath (bundles `@better-auth/drizzle-adapter`) |
| `drizzle-orm` | `0.45.2` | ARCHITECTURE-SPINE "Drizzle ORM 0.40+" |
| `drizzle-kit` | `0.31.10` | Paired with drizzle-orm 0.45.x |
| `postgres` | `3.4.9` | **Driver choice:** `postgres` (postgres-js) — Bun-native, Drizzle-recommended for PG; no `pg`/`node-postgres` (not ratified) |

Add as `dependencies` except `@better-auth/cli` + `drizzle-kit` as `devDependencies`.

### better-auth schema generation — decision (encode exactly)

**Use CLI generation for all better-auth tables; hand-write app tables only.**

| Layer | Method | Path |
| --- | --- | --- |
| better-auth core + org plugin | `@better-auth/cli generate` | Output → `packages/db/src/schema/better-auth.ts` |
| App tables (workspace_settings, api_keys, renders, …) | Hand-written Drizzle | `packages/db/src/schema/*.ts` |

**Why CLI for auth tables:** better-auth 1.x schema evolves with plugins; manual duplication caused drift in prior projects. App tables are usetagih-specific — hand-written against §7.1.

**Auth config seam (Story 3.1 creates; Story 3.3 extends):**

```text
packages/db/src/auth/auth.config.ts   ← minimal betterAuth() for CLI + future runtime
packages/db/src/auth/index.ts         ← re-export auth config (no HTTP mount here)
```

**Minimal auth config requirements:**

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle"; // subpath export on better-auth@1.6.23
import { organization } from "better-auth/plugins";
import { db } from "../client.js"; // or lazy stub for CLI — see below
import * as schema from "../schema/index.js";

export const authConfig = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      teams: { enabled: false },
    }),
  ],
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authConfig);
```

**CLI invocation (commit script in package.json):**

```bash
bunx @better-auth/cli@1.6.23 generate \
  --config ./src/auth/auth.config.ts \
  --output ./src/schema/better-auth.ts \
  --yes
```

**CLI caveat:** if `db` client requires live Postgres at import time, use a **lazy proxy** or minimal `DATABASE_URL`-gated client in `auth.config.ts` so `generate` runs without Postgres. Story 3.3 replaces nothing — it imports the same config and mounts routes.

**After generation:**

1. Review `better-auth.ts` — must include `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`
2. Must **not** include team-related tables
3. Add/adjust Drizzle `relations()` in `schema/relations.ts` if CLI omitted them (better-auth 1.4+ joins need relations)
4. **Commit** generated file — do not re-run CLI on every build

**Do NOT** in this story: mount `/api/auth/*`, configure GitHub OAuth secrets, or call `auth.api.*` from tests.

### Package layout (implement exactly)

```text
packages/db/
├── drizzle.config.ts
├── migrations/
│   └── YYYYMMDDHHMMSS_initial_core.sql
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                 # public exports: createDb, schema, RenderRepo
    ├── client.ts                # postgres-js + drizzle client factory
    ├── auth/
    │   ├── auth.config.ts       # betterAuth config seam
    │   └── index.ts
    ├── schema/
    │   ├── index.ts             # re-export all tables + relations
    │   ├── better-auth.ts       # CLI-generated — DO NOT hand-edit except post-gen fixes
    │   ├── enums.ts             # workspace_tier, render_status pgEnums
    │   ├── workspace-settings.ts
    │   ├── api-keys.ts
    │   ├── renders.ts
    │   ├── idempotency-keys.ts
    │   ├── audit-events.ts
    │   ├── usage-counters.ts
    │   └── relations.ts         # drizzle relations for all tables
    └── repositories/
        ├── render-repo.ts
        └── render-repo.test.ts  # or src/isolation.test.ts
```

### drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://usetagih:usetagih_dev@localhost:5432/usetagih",
  },
});
```

### package.json scripts

```json
{
  "scripts": {
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "build": "tsc --outDir dist",
    "generate:auth-schema": "bunx @better-auth/cli@1.6.23 generate --config ./src/auth/auth.config.ts --output ./src/schema/better-auth.ts --yes",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate"
  }
}
```

Add `"migrate"` to turbo if needed, or invoke via filter only (no turbo task required for MVP).

### Table definitions — implement exactly

#### Shared enums (`schema/enums.ts`)

```typescript
export const workspaceTierEnum = pgEnum("workspace_tier", [
  "trial",
  "starter",
  "pro",
  "business",
]);

export const renderStatusEnum = pgEnum("render_status", [
  "processing",
  "completed",
  "failed",
]);
```

#### `workspace_settings`

| Column | Type | Constraints |
| --- | --- | --- |
| `organization_id` | `uuid` | PK, FK → `organization.id` ON DELETE CASCADE |
| `tier` | `workspace_tier` | NOT NULL, DEFAULT `'trial'` |
| `branding` | `jsonb` | NULL — logo URL, colors, footer overrides |
| `business_identity` | `jsonb` | NULL — default seller name/address/tax id |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |

#### `api_keys`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() |
| `workspace_id` | `uuid` | NOT NULL, FK → `organization.id` ON DELETE CASCADE |
| `name` | `text` | NOT NULL |
| `prefix` | `text` | NOT NULL — display prefix (first chars of key) |
| `key_hash` | `text` | NOT NULL — argon2 hash (app layer) |
| `scopes` | `text[]` | NOT NULL — values: `renders:read`, `renders:write`, `webhooks:manage`, `audit:read` |
| `expires_at` | `timestamptz` | NULL |
| `revoked_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Indexes:** `(workspace_id)`, `(workspace_id, revoked_at)` where revoked_at IS NULL partial optional.

#### `renders`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() |
| `workspace_id` | `uuid` | NOT NULL, FK → `organization.id` ON DELETE CASCADE |
| `document_type` | `text` | NOT NULL — `invoice`\|`quotation`\|`receipt` |
| `template` | `text` | NOT NULL — `modern`\|`classic` |
| `schema_version` | `text` | NOT NULL — e.g. `2026-07-20` |
| `status` | `render_status` | NOT NULL |
| `idempotency_hash` | `text` | NULL — SHA-256 of Idempotency-Key + workspace + endpoint |
| `payload_hash` | `text` | NOT NULL — SHA-256 canonical payload |
| `r2_key` | `text` | NULL — `renders/{workspaceId}/{renderId}.pdf` |
| `sha256` | `text` | NULL — PDF bytes hash |
| `byte_size` | `bigint` | NULL |
| `share_token` | `text` | NULL |
| `share_expires_at` | `timestamptz` | NULL |
| `logo_checksum` | `text` | NULL — SHA-256 persisted logo bytes (snapshot) |
| `resolved_tier` | `workspace_tier` | NOT NULL — tier at render time |
| `show_watermark` | `boolean` | NOT NULL — `true` when `resolved_tier === 'trial'` |
| `branding_snapshot` | `jsonb` | NULL — merged branding at render time |
| `error_code` | `text` | NULL — from `@usetagih/schema` error codes when failed |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Indexes:** `(workspace_id)`, `(workspace_id, created_at DESC)`, `(workspace_id, idempotency_hash)` unique partial where idempotency_hash IS NOT NULL.

**Snapshot rule (AD-7, §4.3):** `show_watermark = (resolved_tier === 'trial')` at insert time in render stories; columns exist in 3.1 schema only.

#### `idempotency_keys`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() |
| `workspace_id` | `uuid` | NOT NULL, FK → `organization.id` ON DELETE CASCADE |
| `endpoint` | `text` | NOT NULL — e.g. `POST /v1/invoices/render` |
| `key_hash` | `text` | NOT NULL — SHA-256 of raw Idempotency-Key |
| `request_hash` | `text` | NOT NULL — SHA-256 canonical request body |
| `response_body` | `jsonb` | NOT NULL — cached API response snapshot |
| `expires_at` | `timestamptz` | NOT NULL — created + 24h |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Unique index:** `(workspace_id, endpoint, key_hash)`.

#### `audit_events` (append-only)

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, DEFAULT gen_random_uuid() |
| `workspace_id` | `uuid` | NULL allowed, FK → `organization.id` ON DELETE SET NULL |
| `user_id` | `uuid` | NOT NULL, FK → `user.id` ON DELETE CASCADE |
| `action` | `text` | NOT NULL — e.g. `login`, `api_key.create`, `render.create` |
| `resource_type` | `text` | NULL |
| `resource_id` | `text` | NULL |
| `outcome` | `text` | NOT NULL — `success`\|`failure` |
| `ip` | `text` | NULL |
| `metadata` | `jsonb` | NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() |

**Indexes:** `(workspace_id, created_at DESC)`, `(user_id, created_at DESC)`.

**Nullable workspace_id allowed actions (enforce in app layer; document in repo):** `signup`, `login`, `workspace.bootstrap` — all other actions require non-null `workspace_id`.

#### `usage_counters`

| Column | Type | Constraints |
| --- | --- | --- |
| `workspace_id` | `uuid` | NOT NULL, FK → `organization.id` ON DELETE CASCADE |
| `month` | `date` | NOT NULL — first day of calendar month (YYYY-MM-01) |
| `render_count` | `integer` | NOT NULL, DEFAULT 0 |

**Primary key:** `(workspace_id, month)`.

### Render repository — workspace isolation (AC: 7)

Implement `RenderRepo` primitives (Story 3.2 formalizes port interface):

```typescript
export function createRenderRepo(db: Db) {
  return {
    async insert(input: NewRender): Promise<Render> { /* ... */ },
    async getByIdAndWorkspace(renderId: string, workspaceId: string): Promise<Render | null> {
      // MUST filter both id AND workspace_id
    },
    async listByWorkspace(workspaceId: string, limit = 50): Promise<Render[]> {
      // MUST filter workspace_id
    },
  };
}
```

### Cross-workspace isolation test plan

**File:** `packages/db/src/repositories/render-repo.test.ts` (or `src/isolation.test.ts`)

**Precondition:** Postgres running (`docker compose -f docker/compose.yml up -d postgres`); migrations applied.

**Setup:**

1. Insert two `organization` rows (`org_a`, `org_b`) + matching `workspace_settings` (tiers `trial` and `pro`)
2. Insert one `renders` row per org with distinct `document_type`/`payload_hash`
3. Call `getByIdAndWorkspace(renderA.id, orgB.id)` → **null**
4. Call `listByWorkspace(orgA.id)` → contains only org A render
5. Call `listByWorkspace(orgB.id)` → contains only org B render

**Skip pattern when DB unavailable:**

```typescript
const dbUrl = process.env.DATABASE_URL ?? DEV_ENV_DEFAULTS.DATABASE_URL;
let dbAvailable = false;
try {
  // quick connect probe
  dbAvailable = true;
} catch { /* skip */ }

describe.skipIf(!dbAvailable)("workspace isolation", () => { /* ... */ });
```

### Local Postgres connection (Story 0.3 + 0.6)

From `docker/compose.yml` header:

```
DATABASE_URL=postgresql://usetagih:usetagih_dev@localhost:5432/usetagih
```

Use `parseEnv("dev", process.env)` from `@usetagih/config/env` in `client.ts` — matches Story 0.6 dev default.

**Migrate workflow:**

```bash
docker compose -f docker/compose.yml up -d postgres
bun run --filter @usetagih/db migrate
bun test packages/db
bunx turbo run lint typecheck test build --force
```

### Verification (required)

- Unit/integration tests: `bun test packages/db`
- Workspace gate: `bunx turbo run lint typecheck test build --force` from repo root (always `--force`)
- Generated artifacts: commit `packages/db/migrations/*.sql`; do **not** gitignore migrations

### Out of scope boundaries

| Item | Owner story |
| --- | --- |
| `webhooks`, `webhook_deliveries` tables | Epic 4 Story 4.3 |
| better-auth HTTP routes, OAuth, session middleware | Story 3.3 |
| `packages/core` ports (`RenderRepo` interface) | Story 3.2 |
| Argon2 hashing of API keys | Story 3.5 |
| Idempotency middleware behavior | Story 3.7 |
| Render insert with snapshot population | Story 3.11 |
| `packages/db/seed/dev.ts` full seed | Optional stub only; full seed when 3.3 needs test user |
| Duplicate `workspaces` table | **Forbidden** — use `organization` |

### Previous story intelligence (Epic 2)

- **Exact version pins:** Story 2.5 pinned `@asteasolutions/zod-to-openapi@8.5.0` exactly — mirror pattern for db deps (no `^` on better-auth/drizzle).
- **Turbo `--force`:** Epic 0 retro action item — always use `--force` on verification commands.
- **Scope boundary gate:** Do not modify `packages/schema`, `packages/core`, or `apps/*` except if `@usetagih/db` exports require zero app changes (preferred: no app changes in 3.1).
- **Epic 2 done:** `@usetagih/schema` has 58 tests, error codes, OpenAPI components — import `ErrorCode` type for `renders.error_code` typing only if useful; no schema package changes required.

### Current repo state (read before editing)

| Path | State |
| --- | --- |
| `packages/db/src/index.ts` | Stub export `DB_STUB` — **replace** |
| `packages/db/package.json` | No drizzle/better-auth deps yet |
| `docker/compose.yml` | Postgres 16 on 5432, credentials above |
| `packages/config/src/env/schema.ts` | `DATABASE_URL` dev default matches compose |

### Project Structure Notes

- Aligns with SOLUTION-DESIGN §6 `packages/db/` layout
- `apps/api/drizzle/` re-export deferred until Story 3.3+ needs migrate in container — 3.1 runs migrate from package script
- Naming: kebab-case files, camelCase exports (ARCHITECTURE-SPINE conventions)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.1 AC]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md §7.1, §4.1, §4.3, §7.2, §8.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md AD-5, AD-6, AD-7, Stack table]
- [Source: _bmad-output/planning-artifacts/correct-course-2026-07-20-harness-directives.md — Applied notes 5, 7]
- [Source: docker/compose.yml — DATABASE_URL]
- [Source: packages/config/src/env/schema.ts — DATABASE_URL default]
- [Source: _bmad-output/implementation-artifacts/0-3-local-docker-compose-for-postgres-and-minio.md]
- [Source: better-auth Drizzle adapter docs — CLI `generate` + `drizzle-kit migrate`]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (implementation subagent)

### Debug Log References

- `@better-auth/cli@1.6.23` is not published on npm; schema generation uses `auth@1.6.23` CLI (same version as `better-auth@1.6.23`).
- Auth config sets `advanced.database.generateId: "uuid"` so app FK types align with ARCHITECTURE-SPINE uuid PKs.

### Completion Notes List

- Replaced `@usetagih/db` stub with Drizzle schema, migrations, `createDb`, and workspace-scoped `RenderRepo`.
- Generated better-auth tables via CLI (organization plugin, teams disabled); hand-wrote app tables per §7.1.
- Initial migration `0000_white_trish_tilby.sql` creates 13 tables; no `workspaces` or webhook tables.
- Cross-workspace isolation: 2 pass / 0 fail (`bun test packages/db`); turbo 36/36 tasks green with `--force`.

### File List

- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/drizzle.config.ts`
- `packages/db/migrations/0000_white_trish_tilby.sql`
- `packages/db/migrations/meta/0000_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/src/index.ts`
- `packages/db/src/client.ts`
- `packages/db/src/auth/auth.config.ts`
- `packages/db/src/auth/index.ts`
- `packages/db/src/schema/better-auth.ts`
- `packages/db/src/schema/enums.ts`
- `packages/db/src/schema/workspace-settings.ts`
- `packages/db/src/schema/api-keys.ts`
- `packages/db/src/schema/renders.ts`
- `packages/db/src/schema/idempotency-keys.ts`
- `packages/db/src/schema/audit-events.ts`
- `packages/db/src/schema/usage-counters.ts`
- `packages/db/src/schema/relations.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/repositories/render-repo.ts`
- `packages/db/src/repositories/render-repo.test.ts`
- `packages/db/src/index.test.ts` (deleted)
- `bun.lock`
- `_bmad-output/implementation-artifacts/3-1-drizzle-database-schema-and-migrations-for-core-tables.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-07-20: Epic 3 Story 3.1 — Drizzle core schema, migrations, render repo, isolation tests.
- 2026-07-20: Code review — strengthened isolation probes, documented auth CLI provenance and org-plugin contract.
