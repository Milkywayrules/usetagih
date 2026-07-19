---
baseline_commit: 238e52d1f3f8bf5be019ad063f03cb577df3c6fd
---

# Story 0.2: shared TypeScript and Biome config package

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer,
I want shared `packages/config` for tsconfig and Biome/ultracite,
so that all packages use consistent lint and compile settings (NFR quality baseline).

## Acceptance Criteria

1. **Given** Story 0.1 complete (`packages/config/` is an empty stub with `.gitkeep` only), **when** `@usetagih/config` is implemented, **then** `packages/config/package.json` exists with scoped name `@usetagih/config`, `"private": true`, turbo scripts (`lint`, `typecheck`, `test`, `build`), and `exports` for shared config paths listed in Dev Notes.
2. **Given** `@usetagih/config`, **when** `packages/config/tsconfig/base.json`, `library.json`, and `app.json` are inspected, **then** `base.json` holds shared `compilerOptions` (target `ES2022`, `module` `ESNext`, `moduleResolution` `bundler`, `strict`, `skipLibCheck`, `esModuleInterop`, `isolatedModules`) and `"types": ["bun-types"]` so `bun:test` imports typecheck without per-package excludes.
3. **Given** `library.json` extends `base.json`, **when** used by workspace library packages, **then** it sets `outDir` `dist`, `rootDir` `src`, `declaration` true, and `include` `["src/**/*"]` with **no** `exclude` of `*.test.ts`.
4. **Given** `app.json` extends `base.json`, **when** used by workspace apps, **then** it sets `include` `["src/**/*"]` with **no** test-file exclude; apps may override `compilerOptions` locally (`outDir`/`declaration` for `@usetagih/api`, `noEmit` true for `@usetagih/web` and `@usetagih/mcp` stubs).
5. **Given** shared biome config at `packages/config/biome.json`, **when** root `biome.jsonc` is inspected, **then** it extends `./packages/config/biome.json` (which itself extends `ultracite/biome/core` and owns repo-wide `files.includes` / `!!` exclusions currently in root).
6. **Given** each of the eight pre-existing workspace members (`apps/api`, `apps/web`, `apps/mcp`, `packages/schema`, `packages/core`, `packages/render`, `packages/sdk`, `packages/db`), **when** their `tsconfig.json` is inspected, **then** each extends the correct shared preset via `@usetagih/config/tsconfig/<variant>.json`, lists `"@usetagih/config": "workspace:*"` in `devDependencies`, and **removes** the Story 0.1 stopgap `"exclude": ["src/**/*.test.ts"]`.
7. **Given** root `tsconfig.json`, **when** inspected, **then** it extends `./packages/config/tsconfig/base.json` and keeps `"files": []` (solution-style root for IDE/turbo only).
8. **Given** `@usetagih/config` declares `bun-types` (and `@biomejs/biome` if needed for its own lint script), **when** `bun install` runs at repo root, **then** install completes with zero errors and workspace count is nine members (eight existing + `@usetagih/config`).
9. **Given** existing stub tests (e.g. `apps/api/src/index.test.ts` importing `bun:test`), **when** `bunx turbo run typecheck` runs, **then** all packages pass typecheck **including** `*.test.ts` files (no test excludes).
10. **Given** turbo pipelines unchanged from Story 0.1, **when** `bunx turbo run lint typecheck test build` runs from repo root, **then** all four tasks exit 0 across every workspace member.
11. **Given** at least one package runs `bun test`, **when** turbo `test` task completes, **then** stub tests pass (minimum: `@usetagih/api` test asserting `API_STUB`).
12. **Out of scope (Stories 0.3–0.6):** docker compose, GitHub Actions CI, GHCR workflows, Doppler/env validation schema, Next.js-specific tsconfig (Epic 6), React/Mantine biome presets — do not add here.

## Tasks / Subtasks

- [ ] Task 1 — Create `@usetagih/config` package skeleton (AC: 1, 8)
  - [ ] Replace `packages/config/.gitkeep` with `package.json` (`name: @usetagih/config`, exports map, turbo scripts)
  - [ ] Add `devDependencies`: `bun-types`, `typescript` `^5.8.0` (and `@biomejs/biome` if local lint needs it)
  - [ ] Add `packages/config/tsconfig.json` extending `./tsconfig/library.json` (config package typechecks its own stub)
  - [ ] Add `src/index.ts` exporting `CONFIG_STUB` constant + `src/index.test.ts` smoke test
  - [ ] `build` script: no-op acceptable (`node -e "process.exit(0)"`) — config package emits no `dist/`
- [ ] Task 2 — Shared TypeScript presets (AC: 2–4, 7)
  - [ ] Create `packages/config/tsconfig/base.json` with shared compiler options + `"types": ["bun-types"]`
  - [ ] Create `packages/config/tsconfig/library.json` extending `./base.json` with library emit defaults
  - [ ] Create `packages/config/tsconfig/app.json` extending `./base.json` with app defaults (no emit flags — apps override)
  - [ ] Update root `tsconfig.json` to extend `./packages/config/tsconfig/base.json`
- [ ] Task 3 — Shared Biome preset (AC: 5)
  - [ ] Create `packages/config/biome.json` extending `ultracite/biome/core` with current root `files.includes` / `!!` exclusion list
  - [ ] Slim root `biome.jsonc` to extend `./packages/config/biome.json` only (keep `$schema` at root)
  - [ ] Verify `bunx biome check .` from root still exits 0
- [ ] Task 4 — Rewire workspace member tsconfigs (AC: 4, 6, 9)
  - [ ] Add `@usetagih/config` workspace devDependency to all eight existing members
  - [ ] **Libraries** (`packages/schema`, `core`, `render`, `sdk`, `db`): extend `@usetagih/config/tsconfig/library.json`; remove test excludes
  - [ ] **Apps** (`apps/api`, `web`, `mcp`): extend `@usetagih/config/tsconfig/app.json`
    - [ ] `apps/api`: keep `outDir`/`rootDir`/`declaration` overrides for `tsc --outDir dist`
    - [ ] `apps/web`, `apps/mcp`: keep `"noEmit": true` override for stub typecheck
  - [ ] Delete `"extends": "../../tsconfig.json"` pattern everywhere — no member should extend root tsconfig directly
- [ ] Task 5 — Verification gate (AC: 9–11)
  - [ ] Run verification commands in Testing Requirements; all must pass before marking story done
  - [ ] Confirm `grep -r 'exclude.*test' apps/*/tsconfig.json packages/*/tsconfig.json` returns no matches (except `@usetagih/config` presets if intentionally absent)

## Dev Notes

### Goal

Replace Story 0.1 stopgaps (root-only tsconfig, per-package `exclude` of `src/**/*.test.ts`) with a **single shared config package** per SOLUTION-DESIGN §6 and Epic 0 Story 0.2. This unblocks Story 0.4 CI (lint/typecheck/test/build) and ensures `bun:test` types work repo-wide.

### Current repo state (Story 0.1 landed — do not re-bootstrap)

| Item | Current value | This story changes |
| --- | --- | --- |
| Root `package.json` | workspaces `apps/*`, `packages/*`; `packageManager` `bun@1.2.18`; turbo scripts | unchanged |
| Root `tsconfig.json` | inline `compilerOptions`; `"files": []` | extends `packages/config/tsconfig/base.json` |
| Root `biome.jsonc` | extends `ultracite/biome/core` + scoped `files.includes` | extends `./packages/config/biome.json` |
| Member tsconfigs | `"extends": "../../tsconfig.json"` + `"exclude": ["src/**/*.test.ts"]` | extend `@usetagih/config/tsconfig/*`; **remove excludes** |
| `packages/config/` | `.gitkeep` only — **not** a workspace member | becomes `@usetagih/config` workspace package |
| Stub tests | `import { expect, test } from "bun:test"` in each member | must typecheck via shared `bun-types` |

**Stopgap to remove:** Story 0.1 debug note — `tsc` failed on `bun:test` imports; fixed by excluding `src/**/*.test.ts`. Story 0.2 must fix properly via `bun-types`, not reintroduce excludes.

### Pinned toolchain (do not change major versions)

| Tool | Version | Notes |
| --- | --- | --- |
| Bun | `1.2.x` (`bun@1.2.18` in `packageManager`) | `bun-types` devDep in `@usetagih/config` only — members inherit via tsconfig |
| TypeScript | `^5.8.0` | root + members; config package re-exports presets only |
| Biome | `^2.0.0` (root devDep) | ultracite v7 preset path `ultracite/biome/core` |
| ultracite | `^7.0.0` | do not use deprecated `ultracite/core` |

### Exact `@usetagih/config` deliverables

```text
packages/config/
├── package.json              # name: @usetagih/config
├── biome.json                # extends ultracite/biome/core + shared files.includes
├── tsconfig.json             # extends ./tsconfig/library.json (this package only)
├── tsconfig/
│   ├── base.json             # shared compilerOptions + types: [bun-types]
│   ├── library.json          # extends base — emit library defaults
│   └── app.json              # extends base — app defaults (overrides in app tsconfig)
└── src/
    ├── index.ts              # CONFIG_STUB export
    └── index.test.ts         # bun:test smoke test
```

#### `packages/config/package.json` (required shape)

```json
{
  "name": "@usetagih/config",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    "./tsconfig/base.json": "./tsconfig/base.json",
    "./tsconfig/library.json": "./tsconfig/library.json",
    "./tsconfig/app.json": "./tsconfig/app.json",
    "./biome.json": "./biome.json"
  },
  "scripts": {
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "build": "node -e \"process.exit(0)\""
  },
  "devDependencies": {
    "bun-types": "^1.2.0",
    "typescript": "^5.8.0"
  }
}
```

Adjust `bun-types` semver to match Bun 1.2 band at install time; record resolved version in `bun.lock` only.

#### `packages/config/tsconfig/base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "types": ["bun-types"]
  }
}
```

#### `packages/config/tsconfig/library.json`

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

#### `packages/config/tsconfig/app.json`

```json
{
  "extends": "./base.json",
  "include": ["src/**/*"]
}
```

#### `packages/config/biome.json`

Move the **entire** `files.includes` block from current root `biome.jsonc` into this file, plus ultracite extend:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.4/schema.json",
  "extends": ["ultracite/biome/core"],
  "files": {
    "includes": [
      "apps/**",
      "packages/**",
      "package.json",
      "turbo.json",
      "biome.jsonc",
      "tsconfig.json",
      "!!**/.agents",
      "!!**/_bmad",
      "!!**/_bmad-output",
      "!!**/.cursor",
      "!!**/.bmad-loop",
      "!!**/design-artifacts",
      "!!**/docs",
      "!!**/knowledge-base-of-king-the-user"
    ]
  }
}
```

**Biome path rule (Biome v2 `extends`):** globs in an extended file resolve relative to the **extending** config (root `biome.jsonc`), not `packages/config/`. Keep `apps/**`, `packages/**`, etc. exactly as today — root extends `./packages/config/biome.json`, so paths stay repo-root-relative. Verify with `bunx biome check .` from repo root (must still lint stub files under `apps/` and `packages/`).

#### Root `biome.jsonc` after change

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.4/schema.json",
  "extends": ["./packages/config/biome.json"]
}
```

#### Root `tsconfig.json` after change

```json
{
  "extends": "./packages/config/tsconfig/base.json",
  "files": []
}
```

### Per-member tsconfig mapping (exact)

| Path | Extends | Local overrides only |
| --- | --- | --- |
| `packages/schema` | `@usetagih/config/tsconfig/library.json` | none |
| `packages/core` | `@usetagih/config/tsconfig/library.json` | none |
| `packages/render` | `@usetagih/config/tsconfig/library.json` | none |
| `packages/sdk` | `@usetagih/config/tsconfig/library.json` | none |
| `packages/db` | `@usetagih/config/tsconfig/library.json` | none |
| `apps/api` | `@usetagih/config/tsconfig/app.json` | `"compilerOptions": { "outDir": "dist", "rootDir": "src", "declaration": true }` |
| `apps/web` | `@usetagih/config/tsconfig/app.json` | `"compilerOptions": { "noEmit": true }` |
| `apps/mcp` | `@usetagih/config/tsconfig/app.json` | `"compilerOptions": { "noEmit": true }` |

Example member file (`packages/schema/tsconfig.json`):

```json
{
  "extends": "@usetagih/config/tsconfig/library.json"
}
```

Example app stub (`apps/web/tsconfig.json`):

```json
{
  "extends": "@usetagih/config/tsconfig/app.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

Each member `package.json` adds:

```json
"devDependencies": {
  "@usetagih/config": "workspace:*",
  "typescript": "^5.8.0"
}
```

Keep existing scripts unchanged (`lint`: `biome check .`, etc.).

### Architecture compliance

- **SOLUTION-DESIGN §6:** `packages/config/tsconfig/base.json`, `packages/config/biome.json`, `package.json` — matches structural seed.
- **ARCHITECTURE-SPINE Stack:** TypeScript 5.8+, Biome + ultracite — presets centralized here; Epic 6 may add Next/React biome extends **on top of** this base, not replace it.
- **AD-1 / AD-2:** no dependency graph changes — config package must not depend on `@usetagih/schema` or app packages.
- **NFR quality baseline:** shared lint/compile settings before Epic 1 PDF spike and Story 0.4 CI.

### Previous story intelligence (0.1)

- ultracite v7 uses `ultracite/biome/core` — not `ultracite/core`.
- Root biome needed `!!` exclusions for `.agents`, `_bmad-output`, symlinked `knowledge-base-of-king-the-user` — preserve in shared biome config.
- `packages/templates/` stays non-workspace (README only); do not add `package.json` there.
- `packages/core` depends on `@usetagih/schema` only — do not alter dependency edges while editing `package.json` files.
- Turbo graph: `typecheck`/`test` depend on `^build` — config package `build` must remain fast no-op so graph does not deadlock.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `404d0f0` build: initialize turborepo monorepo workspace | created all stub tsconfigs with test excludes — **replace in this story** |
| `238e52d` chore: mark story 0-1 done | baseline for `baseline_commit` frontmatter |
| `858d640` docs: prepare story for turborepo workspace initialization | story file pattern to follow |

### Testing Requirements

Run from repo root after implementation; **all must exit 0**:

```bash
bun install
bunx biome check .
bunx turbo run lint typecheck test build
```

Sanity checks:

```bash
# no test-file excludes remain in member tsconfigs
! grep -R '"exclude".*test' apps/*/tsconfig.json packages/schema/tsconfig.json packages/core/tsconfig.json packages/render/tsconfig.json packages/sdk/tsconfig.json packages/db/tsconfig.json

# shared presets exist
test -f packages/config/tsconfig/base.json
test -f packages/config/tsconfig/library.json
test -f packages/config/tsconfig/app.json
test -f packages/config/biome.json

# workspace includes config package
bun pm ls | grep -F '@usetagih/config'

# bun:test types resolve (api package is canonical stub)
cd apps/api && bunx tsc --noEmit
```

### Anti-patterns (do not do)

- Do **not** keep `"exclude": ["src/**/*.test.ts"]` — that was a Story 0.1 stopgap.
- Do **not** duplicate compiler options in every member tsconfig — only extend shared presets + minimal overrides.
- Do **not** add Next.js `jsx`/`plugins` tsconfig yet — Epic 6 owns `@usetagih/web` Next scaffold.
- Do **not** move Biome/TypeScript devDeps entirely to root-only — members still run `biome check .` and `tsc` locally via turbo.
- Do **not** implement docker, CI, Doppler (Stories 0.3–0.6).
- Do **not** use npm/yarn/pnpm.

### Epic 0 cross-story context

| Story | Delivers after 0.2 |
| --- | --- |
| 0.3 | `docker/compose.yml` — Postgres 16 + MinIO |
| 0.4 | `.github/workflows/ci.yml` — runs `turbo lint typecheck test build` |
| 0.5 | GHCR docker-push workflow skeleton |
| 0.6 | `doppler.yaml` + env validation scaffold |

Story 0.4 CI assumes this story’s shared config exists — CI should not special-case tsconfig paths.

### Project Structure Notes

- `@usetagih/config` becomes the **ninth** workspace member; `packages/templates/` remains non-workspace.
- Member lint continues `"biome check ."` — Biome discovers root/config via filesystem walk; shared rules live in `packages/config/biome.json`.
- Lockfile: run `bun install` after adding `@usetagih/config` and member devDeps; commit updated `bun.lock`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.2]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#6. Repository Layout (Full)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#Structural Seed]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#Stack]
- [Source: _bmad-output/implementation-artifacts/0-1-initialize-turborepo-monorepo-workspace.md — stopgap excludes, ultracite paths, verification commands]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (headless subagent)

### Debug Log References

### Completion Notes List

### File List

- `packages/config/package.json` (new)
- `packages/config/tsconfig.json` (new)
- `packages/config/tsconfig/base.json` (new)
- `packages/config/tsconfig/library.json` (new)
- `packages/config/tsconfig/app.json` (new)
- `packages/config/biome.json` (new)
- `packages/config/src/index.ts` (new)
- `packages/config/src/index.test.ts` (new)
- `packages/config/.gitkeep` (delete)
- `tsconfig.json` (modified — extends shared base)
- `biome.jsonc` (modified — extends shared biome preset)
- `apps/api/tsconfig.json` (modified)
- `apps/api/package.json` (modified — add `@usetagih/config` devDep)
- `apps/web/tsconfig.json` (modified)
- `apps/web/package.json` (modified)
- `apps/mcp/tsconfig.json` (modified)
- `apps/mcp/package.json` (modified)
- `packages/schema/tsconfig.json` (modified)
- `packages/schema/package.json` (modified)
- `packages/core/tsconfig.json` (modified)
- `packages/core/package.json` (modified)
- `packages/render/tsconfig.json` (modified)
- `packages/render/package.json` (modified)
- `packages/sdk/tsconfig.json` (modified)
- `packages/sdk/package.json` (modified)
- `packages/db/tsconfig.json` (modified)
- `packages/db/package.json` (modified)
- `bun.lock` (modified — after `bun install`)

## Change Log

- 2026-07-20: story created and validated — ready for dev
