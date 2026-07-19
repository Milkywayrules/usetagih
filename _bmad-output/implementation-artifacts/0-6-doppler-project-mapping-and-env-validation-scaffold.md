---
baseline_commit: a6c9103233a45b5936d90751849e6bf6117f4047
---

# Story 0.6: Doppler project mapping and env validation scaffold

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer,
I want `doppler.yaml` and env validation stub,
so that secrets are injected at runtime never committed (NFR-4, AD consistency).

## Acceptance Criteria

1. **Given** Stories 0.1–0.5 complete, **when** root `doppler.yaml` is added per Dev Notes, **then** it documents Doppler project `usetagih` with configs `dev`, `staging`, and `prod` (listed in header comments + default `setup.config: dev`), **and** no secret values or tokens exist anywhere in tracked files touched by this story (NFR-4).
2. **Given** `doppler.yaml`, **when** local verification runs (no `doppler login` required), **then** YAML parses successfully and structural greps confirm `project: usetagih`, `config: dev`, and references to `staging`/`prod` in comments — actual Doppler project creation and `doppler setup` are **environment-gated operator steps** documented for King.
3. **Given** `@usetagih/config`, **when** `package.json` exports are inspected, **then** subpath `@usetagih/config/env` resolves to `./src/env/index.ts` (source TypeScript export — build script stays no-op stub per Story 0.2).
4. **Given** `@usetagih/config/env`, **when** the module is imported, **then** it exports `createEnvSchema`, `parseEnv`, `DopplerEnvironment` type, and `DEV_ENV_DEFAULTS` per Dev Notes schema API — implemented with **Zod 4.x** (`zod` added as a runtime `dependencies` entry, not devDependency).
5. **Given** the env schema stub (Story 0.6 scope), **when** `createEnvSchema('prod')` or `createEnvSchema('staging')` validates input, **then** `DATABASE_URL` and `USETAGIH_API_PUBLIC_URL` are **required** non-empty strings and `USETAGIH_API_PUBLIC_URL` must be a valid URL; missing either field throws `ZodError`.
6. **Given** `createEnvSchema('dev')`, **when** input omits both stub vars, **then** parse succeeds using documented dev defaults: `DATABASE_URL` = `postgresql://usetagih:usetagih_dev@localhost:5432/usetagih` (matches `docker/compose.yml` host comment) and `USETAGIH_API_PUBLIC_URL` = `http://localhost:3001` (matches `docker/Dockerfile.api` EXPOSE).
7. **Given** `packages/config/src/env/env.test.ts`, **when** `bun test` runs in `@usetagih/config`, **then** tests prove prod schema rejects missing `DATABASE_URL`, rejects missing `USETAGIH_API_PUBLIC_URL`, and dev schema accepts empty input with defaults applied.
8. **Given** existing workspace from Stories 0.1–0.5, **when** `bunx turbo run lint typecheck test build` runs from repo root after changes, **then** all tasks exit 0 (currently 36/36 workspace tasks).
9. **Out of scope (Epic 1+):** wiring `apps/api` or `apps/web` to call `parseEnv` at boot, full §9 variable Zod fields beyond the two stub vars, Doppler CLI install in CI, Coolify Doppler sync (Epic 8), `.env` files committed to git, changing `ci.yml` or `docker-publish.yml`.

## Tasks / Subtasks

- [ ] Task 1 — Add root `doppler.yaml` (AC: 1–2)
  - [ ] Create `doppler.yaml` at repo root with header comment listing configs `dev|staging|prod` and operator setup steps (environment-gated)
  - [ ] Use Doppler simple `setup:` format: `project: usetagih`, `config: dev` (default local config)
  - [ ] Document `doppler run --config dev|staging|prod -- <cmd>` usage matching SOLUTION-DESIGN §8.2
  - [ ] No secret values, tokens, or placeholder passwords in file
- [ ] Task 2 — Add Zod env schema stub to `@usetagih/config` (AC: 3–6)
  - [ ] Add `"zod": "^4.4.3"` to `packages/config/package.json` `dependencies`
  - [ ] Add export `"./env": "./src/env/index.ts"` to `exports` map
  - [ ] Create `packages/config/src/env/schema.ts` — `createEnvSchema`, `parseEnv`, types
  - [ ] Create `packages/config/src/env/index.ts` — re-export public API
  - [ ] Keep existing `src/index.ts` CONFIG_STUB unchanged (Story 0.2 smoke test preserved)
- [ ] Task 3 — Add bun tests (AC: 7)
  - [ ] Create `packages/config/src/env/env.test.ts` with prod rejection + dev default cases
  - [ ] Use `import { expect, test } from "bun:test"` and `ZodError` from `zod`
- [ ] Task 4 — Verification gate (AC: 8)
  - [ ] Run doppler.yaml static verification (always required — no Doppler login)
  - [ ] Run secret grep proof (always required)
  - [ ] Run `bun test` in `packages/config` (always required)
  - [ ] Run `bunx turbo run lint typecheck test build` (always required)
  - [ ] Mark Doppler dashboard project setup environment-gated
  - [ ] Record results in Dev Agent Record

## Dev Notes

### Goal

Land the **Doppler project mapping file** and **Zod env validation scaffold** per SOLUTION-DESIGN §9 and Epic 0 Story 0.6 — last story of Epic 0. This establishes the secrets contract (`doppler.yaml` + `@usetagih/config/env`) before Epic 1 PDF spike and Epic 3 API runtime wiring.

### Exports layout decision (explicit)

| Decision | **`@usetagih/config/env` subpath → source TypeScript (`./src/env/index.ts`)** |
| --- | --- |
| Rationale | Story 0.2 established `@usetagih/config` as preset + stub package with no-op `build`; env is the first runtime TS export; Bun workspace consumers resolve TS source directly; matches incremental Epic 0 pattern (schema package builds to `dist/` later in Epic 2) |
| Public import | `import { createEnvSchema, parseEnv } from "@usetagih/config/env"` |
| Build/typecheck | `typecheck` script unchanged (`tsc --noEmit` covers `src/env/**`); `build` stays no-op — do **not** add `dist/` emit for env in this story |
| Internal layout | `src/env/schema.ts` (implementation), `src/env/index.ts` (barrel), `src/env/env.test.ts` (tests) |

### Current repo state (Stories 0.1–0.5 landed — do not re-bootstrap)

| Item | Current value | This story changes |
| --- | --- | --- |
| `doppler.yaml` | **absent** | **NEW** at repo root |
| `packages/config/package.json` | exports tsconfig + biome only; no runtime deps | add `./env` export + `zod` dependency |
| `packages/config/src/index.ts` | `CONFIG_STUB` export + smoke test | **unchanged** |
| `packages/config/src/env/` | **absent** | **NEW** schema + tests |
| `.github/workflows/ci.yml` | Story 0.4 | **unchanged** |
| `.github/workflows/docker-publish.yml` | Story 0.5 | **unchanged** |
| `docker/compose.yml` | Postgres + MinIO; documents local `DATABASE_URL` | **unchanged** — defaults sourced from compose header comment |
| Doppler CLI | may or may not be installed locally | verification does **not** require CLI or login |
| Doppler workspace/token | **not configured** | operator setup environment-gated |

### Environment facts (do not guess)

| Fact | Value |
| --- | --- |
| Doppler CLI | May or may not be installed — **never required for story verification** |
| Doppler login/token | **Not configured** — no `doppler login`, no `doppler run`, no `doppler secrets` in verification |
| `doppler.yaml` verification | YAML parse + content greps only |
| Real Doppler project | Operator creates project `usetagih` with configs `dev`, `staging`, `prod` in Doppler dashboard — document steps; environment-gated |
| Local test runner | `bun test` in `packages/config` or `bunx turbo run test` from root |
| Zod version | **4.x** board-ratified per ARCHITECTURE-SPINE stack table — use `^4.4.3` (already in root `bun.lock` via ultracite) |
| Turbo baseline | `bunx turbo run lint typecheck test build` → 36/36 tasks green — must remain green |

### SOLUTION-DESIGN §9 — full variable catalog (operator reference)

**Project:** `usetagih`  
**Configs:** `dev`, `staging`, `prod`

This story implements Zod validation for **stub vars only** (`DATABASE_URL`, `USETAGIH_API_PUBLIC_URL`). All §9 vars must exist in Doppler for operator setup; remaining vars land in Zod schema in Epic 3+ stories.

| Variable | Used by | dev | staging | prod | Notes |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | api, worker | optional (default) | **required** | **required** | default: local compose URL (see below) |
| `BETTER_AUTH_SECRET` | api, web | **required** | **required** | **required** | not in Zod stub — Epic 3 |
| `BETTER_AUTH_URL` | api, web | **required** | **required** | **required** | not in Zod stub — Epic 3 |
| `GITHUB_CLIENT_ID` | api | optional | **required** | **required** | OAuth — Epic 3 |
| `GITHUB_CLIENT_SECRET` | api | optional | **required** | **required** | OAuth — Epic 3 |
| `USETAGIH_API_PUBLIC_URL` | api, web, sdk | optional (default) | **required** | **required** | default: `http://localhost:3001` |
| `USETAGIH_WEB_PUBLIC_URL` | api, web | optional (default) | **required** | **required** | default: `http://localhost:3000` — Epic 3 |
| `USETAGIH_SHARE_SIGNING_SECRET` | api | **required** | **required** | **required** | Epic 3 |
| `USETAGIH_WEBHOOK_SIGNING_SECRET` | api | **required** | **required** | **required** | Epic 3 |
| `R2_ENDPOINT` | api | optional (default) | **required** | **required** | dev default per §8.3: `http://localhost:9000` |
| `R2_BUCKET` | api | optional (default) | **required** | **required** | dev default: `usetagih-artifacts` |
| `R2_ACCESS_KEY_ID` | api | optional (default) | **required** | **required** | dev default: `minioadmin` |
| `R2_SECRET_ACCESS_KEY` | api | optional (default) | **required** | **required** | dev default: `minioadmin` |
| `R2_PUBLIC_URL` | api | optional | optional | optional | optional CDN base in all configs |
| `USETAGIH_RATE_LIMIT_RENDERS_PER_MIN` | api | optional (default `60`) | optional (default `60`) | optional (default `60`) | §9 documents default 60 |
| `SOURCE_DATE_EPOCH` | render CI | optional (default) | optional (default) | **required** | render determinism — Epic 1 |
| `TYPST_BINARY_PATH` | api, render | optional (default `/usr/local/bin/typst`) | optional (default) | optional (default) | §9 default path |
| `NEXT_PUBLIC_USETAGIH_API_URL` | web | optional (default mirrors API URL) | **required** | **required** | Epic 6 web scaffold |
| `DOPPLER_TOKEN` | Coolify | n/a in repo | n/a in repo | n/a in repo | injected at deploy — **never in git** (§9) |

**Validation semantics (stub vars — implement exactly):**

- **`dev`:** `DATABASE_URL` and `USETAGIH_API_PUBLIC_URL` optional; apply defaults when absent.
- **`staging`:** same strictness as **`prod`** — both stub vars required.
- **`prod`:** both stub vars required; reject missing/empty with `ZodError`.

### Exact `doppler.yaml` specification

File path: **`doppler.yaml`** (repo root)

```yaml
# Doppler project mapping — SOLUTION-DESIGN §9 (Environment Variables)
#
# Project: usetagih
# Configs: dev | staging | prod
#
# Operator setup (environment-gated — requires Doppler dashboard access):
#   1. Create Doppler project "usetagih"
#   2. Create configs: dev, staging, prod
#   3. Populate secrets per SOLUTION-DESIGN §9 variable table (no values in git — NFR-4)
#   4. doppler login && doppler setup --no-interactive
#
# Usage:
#   doppler run --config dev -- docker compose -f docker/compose.yml up -d postgres minio
#   doppler run --config dev -- bun run dev
#   doppler run --config staging -- <cmd>
#   doppler run --config prod -- <cmd>
#
# Verification in CI/local dev does NOT require doppler login — YAML parse + greps only.

setup:
  project: usetagih
  config: dev
```

**Notes:**

- Simple (non-monorepo-list) `setup:` format — single project at repo root per SOLUTION-DESIGN §6 layout.
- Default `config: dev` for local `doppler setup`; override at runtime with `--config staging|prod`.
- Do **not** embed secret values, `DOPPLER_TOKEN`, or service-account tokens.

### Exact `@usetagih/config/env` schema API

#### `packages/config/package.json` changes

Add to `dependencies`:

```json
"zod": "^4.4.3"
```

Add to `exports`:

```json
"./env": "./src/env/index.ts"
```

Run `bun install` from repo root to update `bun.lock`.

#### `packages/config/src/env/schema.ts`

```typescript
import { z } from "zod";

export type DopplerEnvironment = "dev" | "staging" | "prod";

/** Dev defaults aligned with docker/compose.yml and Dockerfile.api EXPOSE 3001 */
export const DEV_ENV_DEFAULTS = {
  DATABASE_URL: "postgresql://usetagih:usetagih_dev@localhost:5432/usetagih",
  USETAGIH_API_PUBLIC_URL: "http://localhost:3001",
} as const;

export type EnvStub = {
  DATABASE_URL: string;
  USETAGIH_API_PUBLIC_URL: string;
};

export function createEnvSchema(environment: DopplerEnvironment) {
  if (environment === "dev") {
    return z.object({
      DATABASE_URL: z.string().min(1).default(DEV_ENV_DEFAULTS.DATABASE_URL),
      USETAGIH_API_PUBLIC_URL: z
        .string()
        .url()
        .default(DEV_ENV_DEFAULTS.USETAGIH_API_PUBLIC_URL),
    });
  }

  // staging and prod: strict — no defaults
  return z.object({
    DATABASE_URL: z.string().min(1),
    USETAGIH_API_PUBLIC_URL: z.string().url(),
  });
}

export function parseEnv(
  environment: DopplerEnvironment,
  raw: Record<string, string | undefined>,
): EnvStub {
  return createEnvSchema(environment).parse(raw);
}
```

#### `packages/config/src/env/index.ts`

```typescript
export {
  createEnvSchema,
  parseEnv,
  DEV_ENV_DEFAULTS,
  type DopplerEnvironment,
  type EnvStub,
} from "./schema";
```

#### `packages/config/src/env/env.test.ts` (required test cases)

| Test | Input | Expected |
| --- | --- | --- |
| prod rejects missing DATABASE_URL | `parseEnv('prod', { USETAGIH_API_PUBLIC_URL: 'https://api.example.com' })` | throws `ZodError` |
| prod rejects missing USETAGIH_API_PUBLIC_URL | `parseEnv('prod', { DATABASE_URL: 'postgresql://x' })` | throws `ZodError` |
| prod rejects empty DATABASE_URL | `parseEnv('prod', { DATABASE_URL: '', USETAGIH_API_PUBLIC_URL: 'https://api.example.com' })` | throws `ZodError` |
| staging rejects missing vars | `parseEnv('staging', {})` | throws `ZodError` |
| dev accepts empty input | `parseEnv('dev', {})` | returns `DEV_ENV_DEFAULTS` values |
| dev accepts overrides | `parseEnv('dev', { DATABASE_URL: 'postgresql://custom', USETAGIH_API_PUBLIC_URL: 'http://127.0.0.1:3001' })` | returns provided values |

### Architecture compliance

- **SOLUTION-DESIGN §9:** Doppler project `usetagih`, configs `dev|staging|prod`; variable catalog documented; stub validates `DATABASE_URL` + `USETAGIH_API_PUBLIC_URL`.
- **SOLUTION-DESIGN §8.2:** `doppler run --config dev --` command shapes documented in `doppler.yaml` header.
- **SOLUTION-DESIGN §6:** `doppler.yaml` at repo root; `packages/config/` owns env validation per structural seed.
- **ARCHITECTURE-SPINE AD (Config):** Doppler project `usetagih`; never commit secrets.
- **ARCHITECTURE-SPINE stack:** Zod 4.x canonical contract library — not a new-dependency decision.
- **NFR-4:** no secrets in repo — grep verification required.

### Previous story intelligence (0.5)

- GHCR workflow + render-ci stub landed; no Doppler tokens in workflow files.
- Story 0.5 cross-reference: Story 0.6 adds env schema — complements NFR-4 secret handling.
- Turbo 36/36 baseline must stay green after config package changes.
- Environment-gated pattern: document operator steps; local verification without external services.

### Previous story intelligence (0.3)

- `docker/compose.yml` header documents local `DATABASE_URL` — use as dev default verbatim.
- Story 0.3 deferred `doppler.yaml` to 0.6 — command shape `doppler run --config dev -- docker compose ...` already documented in compose comments.
- R2 dev defaults in §8.3 documented for operator Doppler `dev` config population (not Zod stub scope).

### Previous story intelligence (0.2)

- `@usetagih/config` export map pattern: subpath keys like `./tsconfig/base.json`.
- `build` is no-op — preserve for this story.
- `bun-types` in devDependencies; `types: ["bun-types"]` in tsconfig/base.json covers `bun:test`.
- Do not remove `CONFIG_STUB` or break `src/index.test.ts`.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `a6c9103` | story 0-5 done — baseline for `baseline_commit` |
| `e2fb71c` | GHCR workflow — no secrets committed pattern |
| `4f73d8c` | story 0-5 created — format + validation record reference |
| `7a87247` | story 0-4 done — turbo CI baseline |

### Testing Requirements

Run from repo root unless noted.

#### Static — `doppler.yaml` parse + greps (always required; no Doppler CLI)

```bash
test -f doppler.yaml

python3 -c "
import sys
try:
    import yaml
except ImportError:
    sys.exit('PyYAML missing — install python3-yaml or: pip install pyyaml')
yaml.safe_load(open('doppler.yaml'))
print('YAML parse OK')
"

grep -q 'project: usetagih' doppler.yaml
grep -q 'config: dev' doppler.yaml
grep -Eiq 'staging|prod' doppler.yaml
grep -q 'SOLUTION-DESIGN' doppler.yaml
grep -q 'doppler run --config dev' doppler.yaml
```

#### Secret grep proof (always required)

```bash
# doppler.yaml and env module must not contain committed secrets
! grep -rE '(gh[pousr]_[A-Za-z0-9]{20,}|dp\.st\.[A-Za-z0-9]+)' doppler.yaml packages/config/src/env/ 2>/dev/null
! grep -rE '^(DATABASE_URL|BETTER_AUTH_SECRET|R2_SECRET_ACCESS_KEY)\s*=' doppler.yaml 2>/dev/null
echo "Secret grep OK"
```

#### Package export + dependency greps (always required)

```bash
grep -q '"./env"' packages/config/package.json
grep -q '"zod"' packages/config/package.json
test -f packages/config/src/env/index.ts
test -f packages/config/src/env/schema.ts
test -f packages/config/src/env/env.test.ts
```

#### Env schema unit tests (always required)

```bash
cd packages/config && bun test src/env/env.test.ts
# or from root:
bun run --filter @usetagih/config test
```

#### Command-parity (always required)

```bash
bunx turbo run lint typecheck test build
```

Expected: all tasks exit 0 (currently 36/36 workspace tasks).

#### Environment-gated — Doppler dashboard + CLI setup

```bash
# Preconditions: Doppler account; project usetagih; configs dev/staging/prod populated per §9
# doppler login && doppler setup --no-interactive
# doppler run --config dev -- printenv DATABASE_URL  # should print injected value, not from git
echo "ENVIRONMENT-GATED — no Doppler workspace/token configured at story creation time"
```

### Anti-patterns (do not do)

- Do **not** commit `.env`, `.env.local`, or secret values in `doppler.yaml`.
- Do **not** require `doppler login` in tests or CI for this story.
- Do **not** add full §9 Zod fields beyond the two stub vars — Epic 3+ expands schema.
- Do **not** wire `parseEnv` into `apps/api` or `apps/web` boot — Epic 3.
- Do **not** change `build` to emit `dist/` for env — source export only in Epic 0.
- Do **not** use Zod 3.x — stack mandates Zod 4.x.
- Do **not** modify `ci.yml` or `docker-publish.yml`.
- Do **not** add `doppler` CLI install to CI.

### Epic 0 cross-story context

| Story | Relationship |
| --- | --- |
| 0.3 | compose documents local DB URL — dev default source |
| 0.4 | CI runs `turbo test` — new env tests must pass in CI when remote exists |
| 0.5 | GHCR workflow — no Doppler tokens; complements NFR-4 |
| 0.6 | **LAST Epic 0 story** — completes monorepo foundation before Epic 1 PDF spike gate |
| Epic 1 | `SOURCE_DATE_EPOCH`, `TYPST_BINARY_PATH` env vars used by render-ci |
| Epic 3 | Full env wiring at API boot; remaining §9 vars in Zod schema |
| Epic 8 | Coolify Doppler sync injects prod secrets |

### Project Structure Notes

```text
doppler.yaml                          # NEW — repo root

packages/config/
├── package.json                      # UPDATE — zod dep + ./env export
└── src/
    ├── index.ts                      # unchanged CONFIG_STUB
    ├── index.test.ts                 # unchanged smoke test
    └── env/                          # NEW
        ├── index.ts                  # public barrel
        ├── schema.ts                 # createEnvSchema, parseEnv
        └── env.test.ts               # prod rejection + dev defaults
```

No changes to `apps/`, `docker/`, or `.github/workflows/` expected.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.6]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#9. Environment Variables (Doppler)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#8.2 Local Development]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#8.3 MinIO as R2 Emulation]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md — Config + Zod 4.x stack]
- [Source: _bmad-output/implementation-artifacts/0-5-ghcr-docker-build-and-push-workflow-skeleton.md — NFR-4, environment-gated pattern]
- [Source: _bmad-output/implementation-artifacts/0-3-local-docker-compose-for-postgres-and-minio.md — DATABASE_URL, doppler command shape]
- [Source: _bmad-output/implementation-artifacts/0-2-shared-typescript-and-biome-config-package.md — @usetagih/config exports pattern]
- [Source: docker/compose.yml — local DATABASE_URL comment]
- [Source: packages/config/package.json — current exports map]

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

_(filled by dev agent)_

### Completion Notes List

_(filled by dev agent)_

### File List

_(filled by dev agent)_

## Story Validation Record

| Check | Result |
| --- | --- |
| Epic 0.6 AC coverage (doppler.yaml, no secrets, Zod stub, prod rejection tests) | PASS |
| SOLUTION-DESIGN §9 variable catalog + stub validation semantics documented | PASS |
| Exports layout decision: `@usetagih/config/env` source subpath + build stays no-op | PASS |
| Exact file paths: `doppler.yaml`, `packages/config/src/env/{index,schema,env.test}.ts` | PASS |
| Environment facts: no doppler login in verification; operator steps environment-gated | PASS |
| Zod 4.x dependency (board-ratified, not new-dependency decision) | PASS |
| Dev defaults sourced from compose.yml + Dockerfile.api (not invented) | PASS |
| Verification commands: YAML parse, greps, bun test, turbo parity | PASS |
| Stories 0.2–0.5 context + out-of-scope fence (API boot wiring, full §9 Zod, CI doppler) | PASS |
| Zero-guess schema API spec + test matrix | PASS |

## Change Log

- 2026-07-20: story created and validated — ready for dev
