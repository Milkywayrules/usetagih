---
baseline_commit: 6a895ef
created: 2026-07-20
---

# Story 3.3: better-auth registration, login, and session middleware

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a direct user (Maya),
I want email/password and GitHub OAuth auth via better-auth,
so that I can access the web app securely (FR-21, AD-7).

## Acceptance Criteria

1. **Given** `better-auth@1.6.23` mounted at `apps/api` on `/api/auth/*` with Drizzle adapter wired to `@usetagih/db`, **when** the Elysia app boots with valid env, **then** better-auth handler serves sign-up, sign-in, sign-out, session, and password-reset routes per better-auth defaults; GitHub OAuth provider is registered when `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` are both set (env-gated — tests do not require real GitHub credentials).
2. **Given** an unauthenticated request, **when** `GET /v1/renders` is called, **then** response is HTTP **401** with JSON body using code `UNAUTHORIZED` (minimal envelope — full `requestId` prefix deferred to Story 3.6).
3. **Given** better-auth organization plugin with `teams` disabled, **when** any invitation, member-add, join, or team mutation is attempted via better-auth org API routes, **then** the operation is rejected (HTTP 403 or 400 per better-auth) — workspace cannot gain a second member; integration test matrix covers every org **mutation** route listed in Dev Notes §Second-member rejection matrix.
4. **Given** email/password registration, **when** user submits sign-up **without** workspace name + slug, **then** registration is rejected; **when** user submits via `POST /api/auth/sign-up-with-workspace` with `{ email, password, name, workspaceName, workspaceSlug }`, **then** user account, organization (workspace), owner `member` row, `workspace_settings` row (`tier: trial`), and session with `activeOrganizationId` set are created atomically; audit events `signup` and `workspace.bootstrap` appended.
5. **Given** authenticated session with zero organizations (e.g. post-GitHub OAuth before bootstrap), **when** `GET /v1/renders` is called, **then** HTTP **403** with code `WORKSPACE_REQUIRED`.
6. **Given** authenticated session with ≥1 organization but `activeOrganizationId` unset, **when** `GET /v1/renders` is called, **then** HTTP **403** with code `WORKSPACE_REQUIRED`.
7. **Given** authenticated session with `activeOrganizationId` set, **when** `GET /v1/renders` is called, **then** HTTP **501** stub body `{ error: { code: "NOT_IMPLEMENTED", message: "Render list lands in Story 3.12" } }` (literal string code — not yet in `@usetagih/schema` `ERROR_CODES`; full envelope in Story 3.6) — proves auth + workspace guard chain passes; Story 3.12 replaces handler only.
8. **Given** successful email/password login, **when** session is established, **then** an audit event with `action: "login"`, `workspaceId: null`, `outcome: "success"` is appended to `audit_events`.
9. **Given** `@usetagih/config/env` schema extended per Dev Notes §Env schema, **when** `apps/api` boots in `dev`, **then** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `USETAGIH_API_PUBLIC_URL` parse correctly; GitHub vars optional in `dev`, required in `staging`/`prod`.
10. **Given** compose Postgres running, **when** `bun test apps/api` runs integration suite, **then** tests boot real Elysia app on ephemeral port, drive better-auth endpoints via `fetch`, and cover: register + workspace bootstrap + `activeOrganizationId`; login audit row; second-member rejection matrix; unauthenticated 401; workspace-guard 403 cases.
11. **Given** workspace, **when** `bunx turbo run lint typecheck test build --force` runs from repo root, **then** all tasks exit 0.
12. **Out of scope (later Epic 3 stories):** `POST /v1/session/token` Bearer exchange (Story 3.4); `/v1/workspaces` CRUD and active-workspace REST (Story 3.18 — 3.3 owns bootstrap-during-signup only); unified error envelope + `requestId` on all routes (Story 3.6); API key auth (Story 3.5); real render list implementation (Story 3.12); `GET /v1/audit` (Story 3.14).

## Tasks / Subtasks

- [x] Task 1 — Extend env schema (AC: 9)
  - [x] Add auth vars to `packages/config/src/env/schema.ts` per Dev Notes §Env schema
  - [x] Extend `EnvStub` type and update `packages/config/src/env/env.test.ts`
  - [x] Create `apps/api/src/env.ts` calling `parseEnv` / api-specific parse helper
- [x] Task 2 — Runtime auth config + db audit adapter (AC: 1, 4, 8)
  - [x] Extend `packages/db/src/auth/auth.config.ts` per Dev Notes §Auth config extensions (export runtime `auth` — do not break CLI schema generation)
  - [x] Re-export `auth`, `authConfig` from `packages/db/src/index.ts`
  - [x] Implement `packages/db/src/repositories/audit-repo.ts` (`createAuditRepo` implements `@usetagih/core` `AuditRepo`)
  - [x] Export `createAuditRepo` from `packages/db`
- [x] Task 3 — Elysia app scaffold (AC: 1, 2, 7)
  - [x] Pin `elysia@1.4.29` + dependencies in `apps/api/package.json`
  - [x] Implement `apps/api/src/app.ts` — `createApp(deps)` factory (testable, no listen)
  - [x] Implement `apps/api/src/auth/mount.ts` — `.mount(auth.handler)` + session macro per Dev Notes §Elysia mount pattern
  - [x] Implement `apps/api/src/routes/health.ts` — `GET /health` → `{ status: "ok" }`
  - [x] Replace stub `apps/api/src/index.ts` — parse env, `createApp`, `listen` on `PORT` default 3001
- [x] Task 4 — Sign-up with mandatory workspace (AC: 4)
  - [x] Implement `apps/api/src/routes/auth/sign-up-with-workspace.ts` per Dev Notes §Workspace bootstrap mechanism
  - [x] Register route **before** `.mount(auth.handler)` so it is not swallowed
  - [x] Insert `workspace_settings` with `tier: "trial"` in same flow
  - [x] Append audit `signup` + `workspace.bootstrap` via `AuditRepo`
- [x] Task 5 — Session + workspace middleware (AC: 2, 5, 6, 7)
  - [x] Implement `apps/api/src/middleware/session-auth.ts`
  - [x] Implement `apps/api/src/middleware/workspace-guard.ts`
  - [x] Implement guarded `GET /v1/renders` stub returning 501 `NOT_IMPLEMENTED` literal
  - [x] Wire middleware chain on `/v1/*` group in `createApp`
- [x] Task 6 — Login audit hook (AC: 8)
  - [x] Add better-auth hook (e.g. `hooks.after` on sign-in/email sign-in) calling `AuditRepo.append({ action: "login", workspaceId: null, ... })`
- [x] Task 7 — Organization hardening (AC: 3)
  - [x] Apply invitation-blocking measures in `auth.config.ts` per Dev Notes §Invitation-blocking measures
  - [x] Verify `teams: { enabled: false }` unchanged from Story 3.1
- [x] Task 8 — Schema error code (AC: 5, 6)
  - [x] Add `WORKSPACE_REQUIRED` to `packages/schema/src/errors/codes.ts` + `http-status.ts` (403)
  - [x] Export from `packages/schema` index; update codes test
- [x] Task 9 — Integration tests (AC: 3, 4, 8, 10)
  - [x] Create `apps/api/src/integration/auth.integration.test.ts` per Dev Notes §Integration test harness
  - [x] Second-member rejection matrix — one test per mutation route
  - [x] Skip suite when `probeDb()` false (document header)
- [x] Task 10 — Verification gate (AC: 11)
  - [x] `docker compose -f docker/compose.yml up -d postgres` (if not running)
  - [x] `bun run --filter @usetagih/db migrate`
  - [x] `bun test apps/api`
  - [x] `bunx turbo run lint typecheck test build --force`

## Dev Notes

### Goal

Replace the Story 0.1 `@usetagih/api` stub with a **real Elysia runtime**: better-auth at `/api/auth/*`, session cookie auth, workspace guard middleware, and integration tests against compose Postgres. This is the first Epic 3 story with a bootable HTTP server — follow verify-first: tests must `fetch` a live app, not mock auth internals.

### Binding ratified sources

| Ref | Requirement for 3.3 |
| --- | --- |
| **FR-21** | Email/password + GitHub OAuth; mandatory first workspace; session `activeOrganizationId`; block unauthenticated access |
| **FR-27 (partial)** | Login event in `audit_events` |
| **AD-7** | better-auth + org plugin; teams off; single-member workspaces; audit append-only |
| **ARCHITECTURE-SPINE AD-7** | Session semantics; org → workspace mapping; invitation/member ops disabled at app layer |
| **SOLUTION-DESIGN §4.1 step 1** | Authenticate before `/v1/*` resource routes |
| **SOLUTION-DESIGN §5.4** | `403 WORKSPACE_REQUIRED` when zero workspaces or active unset on resource routes; **Story 3.18 owns `/v1/workspaces` CRUD** — 3.3 owns bootstrap-during-signup only |
| **SOLUTION-DESIGN §12.1** | Structured logs will carry `workspaceId` on render path (Story 3.11+) — 3.3 middleware must expose `activeOrganizationId` as `workspaceId` in Elysia context for downstream routes |
| **SOLUTION-DESIGN §9** | Env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_*`, `USETAGIH_API_PUBLIC_URL` |
| **SOLUTION-DESIGN §15** | Auth mounted at `apps/api` `/api/auth/*` |
| **correct-course A21/A26 note 6** | Explicitly disable/reject invitation, member-add/remove, join, team ops; integration test proving workspace cannot gain second member |
| **correct-course §5.2** | Signup: register → mandatory workspace (name + slug); `session.activeOrganizationId`; tier/branding on workspace |
| **Story 3.1 `auth.config.ts` seam** | Extend same file — MUST block `createInvitation`, `acceptInvitation`, `addMember`, join flows |
| **Story 3.2 `AuditRepo` port** | Implement minimal db adapter now (login + bootstrap audit); full query API deferred to 3.14 |

### Scope boundary: 3.3 vs 3.18 (encode exactly)

| Capability | Owner | 3.3 delivers |
| --- | --- | --- |
| First workspace at sign-up (email/password) | **3.3** | `POST /api/auth/sign-up-with-workspace` |
| Post-OAuth workspace bootstrap | **3.3** | Client calls better-auth `POST /api/auth/organization/create` + `set-active` (documented; structurally tested via config) |
| Additional workspace create/list/rename | **3.18** | **Do not** implement `/v1/workspaces` |
| Active workspace REST | **3.18** | Use better-auth `organization/set-active` internally in 3.3 bootstrap only |
| Session → Bearer token | **3.4** | **Do not** implement |

### Architecture compliance

| Ref | Rule |
| --- | --- |
| **AD-1** | Route handlers thin; audit via `AuditRepo` port; db adapter in `packages/db` |
| **Elysia 1.4.29** | Pin exactly — ARCHITECTURE-SPINE stack table |
| **better-auth 1.6.23** | Pin exactly — match Story 3.1 / `packages/db` |
| **NFR-4** | No secrets in repo; env via Doppler/`parseEnv` |
| **Epic 3 verify-first** | Integration tests boot real app + compose Postgres |

### Pinned toolchain (exact — no guessing)

| Package | Pin | Where |
| --- | --- | --- |
| `elysia` | `1.4.29` | `apps/api/package.json` |
| `@elysiajs/cors` | latest compatible with Elysia 1.4.x | `apps/api` — credentials for session cookies in dev |
| `better-auth` | `1.6.23` | already in `packages/db`; re-used by api via workspace import |
| `drizzle-orm` | `0.45.2` | via `@usetagih/db` |
| `postgres` | `3.4.9` | via `@usetagih/db` |
| `zod` | `^4.4.3` | via `@usetagih/config` |

**`apps/api/package.json` workspace dependencies (add all):**

`@usetagih/db`, `@usetagih/core`, `@usetagih/config`, `@usetagih/schema`, `elysia`, `@elysiajs/cors`

Remove `API_STUB` export and stub test — replace with app smoke test (`createApp` returns Elysia instance).

### Env schema extensions (encode exactly)

**File:** `packages/config/src/env/schema.ts`

Extend `EnvStub` and both dev/prod schemas:

```typescript
export const DEV_ENV_DEFAULTS = {
  DATABASE_URL: "postgresql://usetagih:usetagih_dev@localhost:5432/usetagih",
  USETAGIH_API_PUBLIC_URL: "http://localhost:3001",
  BETTER_AUTH_SECRET: "dev-only-min-32-chars-secret-000000", // dev default only — rotate in Doppler for staging/prod
  BETTER_AUTH_URL: "http://localhost:3001/api/auth",
} as const;

// dev schema fields:
BETTER_AUTH_SECRET: z.string().min(32).default(DEV_ENV_DEFAULTS.BETTER_AUTH_SECRET),
BETTER_AUTH_URL: z.string().url().default(DEV_ENV_DEFAULTS.BETTER_AUTH_URL),
GITHUB_CLIENT_ID: z.string().min(1).optional(),
GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

// staging/prod: BETTER_AUTH_SECRET, BETTER_AUTH_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET all required
```

**GitHub OAuth gating:** In `auth.config.ts`, spread social provider only when both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are defined. Integration tests use email/password only; add one structural test asserting OAuth config object includes `github` when env vars set (unit-level, no network).

**`BETTER_AUTH_URL`:** Must equal `{USETAGIH_API_PUBLIC_URL}/api/auth` — document in Doppler; dev defaults pre-aligned.

### Auth config extensions (encode exactly)

**File:** `packages/db/src/auth/auth.config.ts` — extend Story 3.1 seam; keep `satisfies Parameters<typeof betterAuth>[0]`.

```typescript
import { parseEnv } from "@usetagih/config/env";

const env = parseEnv(
  (process.env.DOPPLER_ENVIRONMENT as "dev" | "staging" | "prod") ?? "dev",
  process.env,
);

export const authConfig = {
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.USETAGIH_API_PUBLIC_URL], // extend when web origin known (Story 6.1)
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  advanced: { database: { generateId: "uuid" } },
  socialProviders: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
    : undefined,
  plugins: [
    organization({
      teams: { enabled: false },
      membershipLimit: 1,
      invitationLimit: 0,
      allowUserToCreateOrganization: true,
      organizationLimit: 10, // user may own multiple workspaces (3.18); each org max 1 member
      // Do NOT provide sendInvitationEmail — invitations disabled
      organizationHooks: {
        beforeCreateInvitation: async () => {
          throw new APIError("FORBIDDEN", { message: "Invitations are disabled" });
        },
        beforeAcceptInvitation: async () => {
          throw new APIError("FORBIDDEN", { message: "Invitations are disabled" });
        },
        beforeAddMember: async () => {
          throw new APIError("FORBIDDEN", { message: "Multi-member workspaces are disabled" });
        },
      },
    }),
  ],
} satisfies Parameters<typeof betterAuth>[0];
```

**Import `APIError` from `better-auth/api`** (or equivalent better-auth 1.6 export — verify at implementation time).

**CLI caveat preserved:** `getDb()` lazy singleton from Story 3.1 — `generate:auth-schema` must still run without live Postgres.

### Invitation-blocking measures (contract from Story 3.1 — enumerate all)

| Measure | Purpose |
| --- | --- |
| `teams: { enabled: false }` | No team tables/routes (already in 3.1 schema) |
| `membershipLimit: 1` | Hard cap — second member via any path rejected |
| `invitationLimit: 0` | No pending invitations |
| `beforeCreateInvitation` hook → throw | Block invite API |
| `beforeAcceptInvitation` hook → throw | Block join-via-invite |
| `beforeAddMember` hook → throw | Block direct add-member |
| No `sendInvitationEmail` callback | Invitations non-functional |
| Integration tests | Prove each mutation route fails (matrix below) |

### Second-member rejection matrix (integration tests — one case each)

All paths relative to `BETTER_AUTH_URL` base (e.g. `http://127.0.0.1:{port}/api/auth/...`). Authenticate as workspace owner; attempt to add second user.

| # | Route | Method | Body (minimal) | Expected |
| --- | --- | --- | --- | --- |
| 1 | `/organization/invite-member` | POST | `{ email: "second@example.com", role: "member", organizationId }` | 403 |
| 2 | `/organization/accept-invitation` | POST | `{ invitationId: "<fake-uuid>" }` | 403 |
| 3 | `/organization/add-member` | POST | `{ userId: "<other-user-id>", role: "member", organizationId }` | 403 |
| 4 | `/organization/remove-member` | POST | `{ memberId: "<owner-member-id>", organizationId }` | 403 or 400 — must not leave workspace without owner (optional: skip if better-auth forbids self-remove) |

**Setup:** Create user A + workspace via sign-up-with-workspace. Create user B via separate sign-up-with-workspace. As user A session, attempt mutations targeting A's org with B's userId. Assert member count remains 1 via `GET /organization/list-members` or direct db query in test.

**Teams routes:** Assert `POST /organization/create-team` (if exposed) returns 404 — teams disabled.

### Elysia mount pattern (encode exactly)

**File:** `apps/api/src/auth/mount.ts`

Follow [Better Auth Elysia integration](https://www.better-auth.com/docs/integrations/elysia):

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "@usetagih/db"; // after index re-export

export function createBetterAuthPlugin(options: { apiPublicUrl: string }) {
  return new Elysia({ name: "better-auth" })
    .use(
      cors({
        origin: options.apiPublicUrl,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
      }),
    )
    .mount(auth.handler)
    .macro({
      auth: {
        async resolve({ request: { headers }, status }) {
          const session = await auth.api.getSession({ headers });
          if (!session) return status(401);
          return {
            user: session.user,
            session: session.session,
            workspaceId: session.session.activeOrganizationId ?? null,
          };
        },
      },
    });
}
```

**Mount order in `createApp`:**

1. `GET /health`
2. `POST /api/auth/sign-up-with-workspace` (custom — register before mount)
3. `.use(createBetterAuthPlugin(...))` — mounts `/api/auth/*`
4. `/v1` group with session + workspace guards

### Workspace bootstrap mechanism (encode exactly)

**Route:** `POST /api/auth/sign-up-with-workspace`

**Body schema (Zod in route file):**

```typescript
{
  email: string;      // valid email
  password: string;   // min 8 chars (match better-auth default)
  name: string;       // user display name
  workspaceName: string; // 1–100 chars trim
  workspaceSlug: string; // slug rules below
}
```

**Slug rules:**

- Pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Length: 3–48 characters
- Lowercase only; no leading/trailing hyphen
- Uniqueness: rely on better-auth `createOrganization` slug conflict error → map to 409

**Orchestration (single handler — use `auth.api` server methods with synthetic headers/cookies):**

1. `auth.api.signUpEmail({ body: { email, password, name } })`
2. `auth.api.createOrganization({ body: { name: workspaceName, slug: workspaceSlug }, headers })` — use session from step 1
3. `auth.api.setActiveOrganization({ body: { organizationId: org.id }, headers })`
4. Insert `workspace_settings` row: `{ organizationId: org.id, tier: "trial" }` via Drizzle (`getDb()`)
5. `auditRepo.append({ action: "signup", workspaceId: null, userId, outcome: "success", ip })`
6. `auditRepo.append({ action: "workspace.bootstrap", workspaceId: org.id, userId, outcome: "success", ip, metadata: { slug: workspaceSlug } })`
7. Return `{ user, session, workspaceId: org.id }` — forward `Set-Cookie` headers from auth internal responses onto the composite HTTP response (collect cookies across steps 1–3; use `auth.api` return values + `Set-Cookie` from response headers per better-auth server API)

**Reject** plain `POST /api/auth/sign-up/email` for product flow? **No** — leave better-auth default routes for lower-level testing, but integration test uses composite route only. Document that web app (Story 6.2) must call sign-up-with-workspace.

**Post-GitHub OAuth bootstrap (structural only in tests):** Document that OAuth users with zero orgs call `POST /api/auth/organization/create` then `set-active` — same `workspace_settings` insert can happen in `organizationHooks.afterCreate` hook:

```typescript
afterCreateOrganization: async ({ organization, user }) => {
  await db.insert(workspaceSettings).values({
    organizationId: organization.id,
    tier: "trial",
  });
  await auditRepo.append({ action: "workspace.bootstrap", workspaceId: organization.id, userId: user.id, outcome: "success" });
},
```

Wire hook in auth config with db + auditRepo factory — avoid circular imports (lazy init or inject at apps/api composition root).

### Workspace guard middleware (encode exactly)

**File:** `apps/api/src/middleware/workspace-guard.ts`

Apply to `/v1/*` routes **after** session auth macro resolves.

| Condition | HTTP | Code |
| --- | --- | --- |
| No session | 401 | `UNAUTHORIZED` |
| Session but zero org memberships | 403 | `WORKSPACE_REQUIRED` |
| Session but `activeOrganizationId` null/undefined | 403 | `WORKSPACE_REQUIRED` |
| Session with active org | pass — set `ctx.workspaceId = session.activeOrganizationId` |

**Check zero memberships:** `auth.api.listOrganizations({ headers })` or query `member` table count for user — prefer auth API for consistency.

**Exempt paths from workspace guard:** none in 3.3 except auth routes under `/api/auth/*` (not mounted under `/v1`).

### Placeholder `/v1/renders` stub (encode exactly)

**File:** `apps/api/src/routes/v1/renders.stub.ts`

```typescript
// GET /v1/renders — guarded stub until Story 3.12
.get("/v1/renders", ({ workspaceId }) => ({
  error: {
    code: "NOT_IMPLEMENTED",
    message: "Render list lands in Story 3.12",
  },
}), { auth: true /* + workspace guard plugin */ })
// Respond with HTTP 501
```

Use Elysia `set.status = 501` in handler. Guard chain must run **before** stub — proving 401/403/501 sequence in tests.

### AuditRepo db adapter (encode exactly)

**File:** `packages/db/src/repositories/audit-repo.ts`

```typescript
import type { AuditRepo, AuditAppendInput } from "@usetagih/core";
import { AUDIT_ACTIONS_NULLABLE_WORKSPACE } from "../schema/audit-events.js";

export function createAuditRepo(db: Db): AuditRepo {
  return {
    async append(input: AuditAppendInput) {
      if (
        input.workspaceId === null &&
        !AUDIT_ACTIONS_NULLABLE_WORKSPACE.includes(input.action as typeof AUDIT_ACTIONS_NULLABLE_WORKSPACE[number])
      ) {
        throw new Error(`workspaceId required for action ${input.action}`);
      }
      const [row] = await db.insert(auditEvents).values({ ... }).returning({ id: auditEvents.id });
      return { id: row.id };
    },
  };
}
```

Map field names to snake_case columns per Story 3.1 schema.

### Package layout (implement exactly)

```text
apps/api/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                         # boot: env → createApp → listen
    ├── app.ts                           # createApp(deps?) composes plugins + routes
    ├── env.ts                           # parseApiEnv()
    ├── auth/
    │   ├── mount.ts                     # createBetterAuthPlugin
    │   └── sign-up-with-workspace.ts    # POST handler
    ├── middleware/
    │   ├── session-auth.ts              # re-export/wrap macro if needed
    │   └── workspace-guard.ts
    ├── routes/
    │   ├── health.ts
    │   └── v1/
    │       └── renders.stub.ts
    └── integration/
        └── auth.integration.test.ts

packages/db/src/
├── auth/auth.config.ts                  # UPDATE — runtime config
├── repositories/
│   └── audit-repo.ts                    # NEW
└── index.ts                             # UPDATE — export auth + createAuditRepo

packages/config/src/env/
├── schema.ts                            # UPDATE — auth env vars
└── env.test.ts                          # UPDATE

packages/schema/src/errors/
├── codes.ts                             # UPDATE — WORKSPACE_REQUIRED
└── http-status.ts                       # UPDATE
```

### `createApp` factory (testing — encode exactly)

**File:** `apps/api/src/app.ts`

```typescript
export type AppDeps = {
  db?: Db;
  auditRepo?: AuditRepo;
};

export function createApp(deps: AppDeps = {}) {
  const db = deps.db ?? getDb();
  const auditRepo = deps.auditRepo ?? createAuditRepo(db);
  // compose Elysia chain; return app WITHOUT listening
  return app;
}
```

Integration tests:

```typescript
const app = createApp();
app.listen(0);
const port = app.server?.port;
const base = `http://127.0.0.1:${port}`;
// fetch(`${base}/api/auth/...`, { credentials: "include" })
```

Use `afterAll` to stop server and close db connections if needed.

### Integration test harness (encode exactly)

**File:** `apps/api/src/integration/auth.integration.test.ts`

**Preamble:**

```typescript
import { probeDb } from "@usetagih/db";
const postgresUp = await probeDb();
const describeIntegration = postgresUp ? describe : describe.skip;
```

**Required test cases:**

1. `sign-up-with-workspace creates user, org, workspace_settings, activeOrganizationId`
2. `GET /v1/renders unauthenticated → 401`
3. `GET /v1/renders authenticated without active org → 403 WORKSPACE_REQUIRED`
4. `GET /v1/renders authenticated with active org → 501`
5. `sign-in appends login audit row`
6. `second-member rejection matrix` (table-driven, 3+ routes)
7. `password reset route reachable` — `POST /api/auth/forget-password` returns non-5xx (better-auth default; no email delivery assertion)

**Test isolation:** Use unique email/slug per test (`crypto.randomUUID()` suffix). Clean up optional — test DB may accumulate rows; acceptable for local compose.

### Verification (required)

```bash
docker compose -f docker/compose.yml up -d postgres
bun run --filter @usetagih/db migrate
bun test apps/api
bun test packages/db
bun test packages/config
bunx turbo run lint typecheck test build --force
```

### Previous story intelligence (Story 3.2)

| Source | Learning for 3.3 |
| --- | --- |
| Story 3.2 | `AuditRepo` port exists — implement db adapter now for login/bootstrap |
| Story 3.2 | Adapter direction: `packages/db` imports `@usetagih/core` port types |
| Story 3.2 | Deferred audit db adapter to Stories 3.7/3.14 — **3.3 needs minimal adapter for login AC** |
| Story 3.2 | Turbo `--force` on all verification |

### Previous story intelligence (Story 3.1)

| Source | Learning for 3.3 |
| --- | --- |
| Story 3.1 | `auth.config.ts` seam — extend, do not duplicate |
| Story 3.1 | `better-auth@1.6.23` + Drizzle adapter subpath |
| Story 3.1 | `organization` IS workspace; `workspace_settings.organization_id` FK |
| Story 3.1 | `AUDIT_ACTIONS_NULLABLE_WORKSPACE` = signup, login, workspace.bootstrap |
| Story 3.1 | Integration tests skip when Postgres unreachable — same pattern |
| Story 3.1 | CLI uses `auth@1.6.23` not `@better-auth/cli` |

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `6448318` feat: core ports | Import `AuditRepo` from `@usetagih/core` |
| `591dc62` fix(db): isolation | Follow probeDb / compose patterns |
| `057696a` docs: story 3-2 | Story file structure, baseline_commit frontmatter |

### Latest technical specifics (better-auth 1.6 + Elysia)

| Topic | Detail |
| --- | --- |
| Elysia mount | `.mount(auth.handler)` — handler includes `/api/auth` prefix when `baseURL` set |
| Session field | `session.activeOrganizationId` — organization plugin sets on `setActiveOrganization` |
| Org plugin limits | `membershipLimit: 1`, `invitationLimit: 0` enforced server-side |
| Password reset | Default routes under `/api/auth/forget-password`, `/reset-password` — no custom implementation |
| OAuth | `socialProviders.github` when creds present |

### Project Structure Notes

- Alignment: `apps/api` becomes composition root per SOLUTION-DESIGN §repo layout (`index.ts` bootstrap, `middleware/`, `routes/v1/`)
- `@usetagih/api` depends on `@usetagih/db`, `@usetagih/core`, `@usetagih/config`, `@usetagih/schema`
- Do **not** import Drizzle in route handlers except through auth/db factories
- Structured log `workspaceId` (§12.1): pass `workspaceId` from middleware context — pino wiring lands Story 8.6; stub comment in middleware OK

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3.3 ACs]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md §4.1, §5.4, §9, §12.1, §15]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md AD-7]
- [Source: _bmad-output/planning-artifacts/correct-course-2026-07-20-harness-directives.md — A21/A26, §5.2, note 6]
- [Source: packages/db/src/auth/auth.config.ts — org plugin contract]
- [Source: packages/core/src/ports/audit-repo.ts]
- [Source: packages/db/src/schema/audit-events.ts — AUDIT_ACTIONS_NULLABLE_WORKSPACE]
- [Source: _bmad-output/implementation-artifacts/3-1-drizzle-database-schema-and-migrations-for-core-tables.md]
- [Source: _bmad-output/implementation-artifacts/3-2-packages-core-ports-and-validate-use-case.md]
- [Source: https://www.better-auth.com/docs/integrations/elysia]
- [Source: https://www.better-auth.com/docs/plugins/organization]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (dev-story headless)

### Debug Log References

- better-auth `beforeAddMember` hook fires during owner bootstrap on `createOrganization`; unconditional throw blocked org creation — hook now rejects only when member count ≥ 1
- `auth.api` multi-step signup requires explicit `Cookie` request header jar (`Set-Cookie` from `returnHeaders` is not auto-forwarded)
- password reset route is `/api/auth/request-password-reset` (not `/forget-password`) in better-auth 1.6.23
- `add-member` is server-only in better-auth; matrix covers it via `auth.api.addMember`

### Completion Notes List

- Extended env schema with `BETTER_AUTH_*`, optional GitHub OAuth in dev, required in staging/prod
- Runtime auth config: org limits, invitation hooks, login audit `hooks.after`, `afterCreateOrganization` for `workspace_settings` + bootstrap audit
- `createAuditRepo` implements `@usetagih/core` `AuditRepo` with nullable-workspace enforcement
- Replaced API stub with Elysia `createApp` factory, better-auth mount, sign-up-with-workspace composite route, workspace guard, `/v1/renders` 501 stub
- Added `WORKSPACE_REQUIRED` error code (403)
- Integration suite: 7 cases against compose Postgres via `fetch` + `probeDb` skip pattern
- Verification: migrate ok; `bun test apps/api` 18 pass (with postgres); packages/db 5 pass; packages/config 9 pass; turbo lint/typecheck/test/build 36/36 pass

### File List

- `_bmad-output/implementation-artifacts/3-3-better-auth-registration-login-and-session-middleware.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/api/package.json`
- `apps/api/src/app.ts`
- `apps/api/src/auth/mount.ts`
- `apps/api/src/env.ts`
- `apps/api/src/index.ts`
- `apps/api/src/index.test.ts`
- `apps/api/src/integration/auth.integration.test.ts`
- `apps/api/src/middleware/session-auth.ts`
- `apps/api/src/middleware/workspace-guard.ts`
- `apps/api/src/routes/auth/sign-up-with-workspace.ts`
- `apps/api/src/routes/health.ts`
- `bun.lock`
- `packages/config/src/env/env.test.ts`
- `packages/config/src/env/schema.ts`
- `packages/db/src/auth/auth.config.ts`
- `packages/db/src/index.ts`
- `packages/db/src/repositories/audit-repo.ts`
- `packages/schema/src/errors/codes.test.ts`
- `packages/schema/src/errors/codes.ts`
- `packages/schema/src/errors/http-status.ts`
- `packages/schema/src/guard/no-duplicate-zod.test.ts`
- `packages/schema/src/index.ts`

## Change Log

- 2026-07-20: Story 3.3 — better-auth registration/login, session middleware, mandatory workspace bootstrap, integration tests
