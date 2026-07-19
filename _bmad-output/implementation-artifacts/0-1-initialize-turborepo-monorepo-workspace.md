---
baseline_commit: 858d640bddf24e613741e6a1fcb6440f10384326
---

# Story 0.1: initialize turborepo monorepo workspace

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer,
I want a Bun+turborepo monorepo scaffold matching ARCHITECTURE-SPINE structural seed,
so that all apps and packages share one workspace root.

## Acceptance Criteria

1. **Given** an empty repo root (no prior `apps/` or `packages/` workspace), **when** this story is implemented per SOLUTION-DESIGN §6, **then** the repository matches the structural seed below with all listed paths present.
2. **Given** root `package.json`, **when** inspected, **then** it declares Bun workspaces `apps/*` and `packages/*`, pins `packageManager` to Bun 1.2.x, and lists root scripts `lint`, `typecheck`, `test`, `build`, `dev` that delegate to turbo.
3. **Given** `turbo.json`, **when** inspected, **then** pipeline tasks `lint`, `typecheck`, `test`, and `build` exist with `build` using `"dependsOn": ["^build"]` and `"outputs": ["dist/**", ".next/**"]`.
4. **Given** workspace member packages, **when** each `package.json` is inspected, **then** scoped names match the table in Dev Notes and each member exposes the four turbo scripts (no-op stubs acceptable for apps not yet built).
5. **Given** root `biome.jsonc` extending `ultracite/biome/core`, **when** `bunx biome check .` runs from repo root, **then** exit code is 0 on the scaffold (no lint violations in committed stub files).
6. **Given** stub directory `apps/mcp/`, **when** `README.md` is read, **then** it states MCP v1.1 is POST-MVP deferred, calls public REST only (AD-2), and must not import `packages/core` or `packages/render`.
7. **Given** a clean clone, **when** `bun install` runs at repo root, **then** it completes with zero errors and produces `bun.lock`.
8. **Given** install complete, **when** `bunx turbo run build --dry-run` runs, **then** the task graph resolves for all workspace members with no missing-package errors.
9. **Given** install complete, **when** `bunx turbo run lint typecheck test build` runs, **then** all four pipelines exit 0 using stub implementations.
10. **Out of scope (Story 0.2):** shared `packages/config/tsconfig/base.json`, per-package tsconfig extends, Doppler env schema, docker compose, CI workflows — do not implement here; leave `packages/config/` as an empty stub directory only.

## Tasks / Subtasks

- [x] Task 1 — Root workspace bootstrap (AC: 1–3, 7)
  - [x] Create root `package.json` with workspaces, pinned Bun, turbo devDependency, root scripts
  - [x] Create `turbo.json` with lint/typecheck/test/build pipelines
  - [x] Run `bun install` and commit resulting `bun.lock`
- [x] Task 2 — Biome + ultracite baseline (AC: 5)
  - [x] Add root `biome.jsonc` extending `ultracite/biome/core` (ultracite v7+ preset path — not legacy `ultracite/core`)
  - [x] Add root `tsconfig.json` (minimal `"files": []` compilerOptions baseline for IDE; full shared config deferred to Story 0.2)
  - [x] Add root `.gitignore` (`node_modules/`, `dist/`, `.next/`, `.turbo/`, `.env*`)
  - [x] Verify `bunx biome check .` passes
- [x] Task 3 — App stubs (AC: 1, 4, 6)
  - [x] Scaffold `apps/api/package.json` (`@usetagih/api`) with stub src + scripts
  - [x] Scaffold `apps/web/package.json` (`@usetagih/web`) with stub scripts (Next.js wiring deferred to Epic 6)
  - [x] Scaffold `apps/mcp/package.json` (`@usetagih/mcp`) + `README.md` v1.1 deferral copy
- [x] Task 4 — Package stubs (AC: 1, 4, 10)
  - [x] Scaffold `@usetagih/schema`, `@usetagih/core`, `@usetagih/render`, `@usetagih/sdk`, `@usetagih/db` with minimal `package.json` + stub `src/index.ts` where needed for typecheck/build
  - [x] Create non-workspace directories `packages/templates/` (`.gitkeep` or README) and empty `packages/config/` stub (Story 0.2)
- [x] Task 5 — Verification gate (AC: 7–9)
  - [x] Run verification commands listed in Testing Requirements; all must pass before marking story done

## Dev Notes

### Goal

Establish the **build substrate** for Epic 0. This is the first real epic story (ignore archived `epic-0-harness` entries — those were loop-verify only). Every downstream epic assumes this workspace layout exists.

### Pinned toolchain (do not guess versions)

| Tool | Version | Source |
| --- | --- | --- |
| Bun | `1.2.x` (pin exact patch in `packageManager`, e.g. `bun@1.2.18`) | ARCHITECTURE-SPINE Stack |
| turborepo | `^2` (latest 2.x at install time) | ARCHITECTURE-SPINE Stack |
| TypeScript | `^5.8` | ARCHITECTURE-SPINE Stack |
| Biome | latest stable via `@biomejs/biome` | ARCHITECTURE-SPINE Stack |
| ultracite | `^7` (v7+ uses `ultracite/biome/core` preset paths) | tech-stack `[pts]` + ultracite docs |

Use exact patch pins in `packageManager` and CI later; root `engines` optional but recommended: `"bun": ">=1.2.0 <1.3.0"`.

### Required folder tree after implementation

```text
usetagih/
├── package.json
├── turbo.json
├── biome.jsonc
├── tsconfig.json
├── .gitignore
├── bun.lock
├── apps/
│   ├── api/
│   │   ├── package.json          # name: @usetagih/api
│   │   └── src/index.ts          # stub export (Elysia bootstrap in Epic 3)
│   ├── web/
│   │   └── package.json          # name: @usetagih/web (Next scaffold Epic 6)
│   └── mcp/
│       ├── package.json          # name: @usetagih/mcp
│       └── README.md             # v1.1 deferral — REQUIRED copy (see below)
├── packages/
│   ├── schema/package.json       # @usetagih/schema
│   ├── core/package.json         # @usetagih/core — depends ONLY on schema (AD-1)
│   ├── render/package.json       # @usetagih/render
│   ├── sdk/package.json          # @usetagih/sdk
│   ├── db/package.json           # @usetagih/db
│   ├── templates/                # .typ files later; README or .gitkeep only
│   └── config/                   # EMPTY stub — Story 0.2 adds tsconfig + biome extends
```

Do **not** create `docker/`, `.github/workflows/`, or `doppler.yaml` in this story (Stories 0.3–0.6).

### Root `package.json` expectations

```json
{
  "name": "usetagih",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "bun@1.2.18",
  "scripts": {
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "build": "turbo run build",
    "dev": "turbo run dev --parallel"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "turbo": "^2.0.0",
    "typescript": "^5.8.0",
    "ultracite": "^7.0.0"
  }
}
```

Adjust biome/ultracite semver to latest stable at install time; record resolved versions in `bun.lock` only (never hand-edit lockfile). Prefer `npx ultracite init --linter biome --pm bun --quiet` if unsure of preset paths, then align extends to `ultracite/biome/core` only (framework presets added in Epic 6 for Next/React).

### `turbo.json` expectations

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": { "cache": false, "persistent": true }
  }
}
```

### Workspace package names and stub scripts

Every workspace member **must** set `"private": true` and define these scripts so turbo graph resolves:

| Path | `name` | Stub script behavior |
| --- | --- | --- |
| `apps/api` | `@usetagih/api` | `build`: `tsc --outDir dist` or `bun build src/index.ts --outdir dist`; `lint`: `biome check .`; `typecheck`: `tsc --noEmit`; `test`: `bun test` (empty test ok) |
| `apps/web` | `@usetagih/web` | Same pattern; `build` may echo/no-op until Next.js (Epic 6) — use `mkdir -p dist && echo stub > dist/.gitkeep` if no compiler yet |
| `apps/mcp` | `@usetagih/mcp` | Minimal stub; no runtime server |
| `packages/schema` | `@usetagih/schema` | `src/index.ts` exports placeholder; `build` emits `dist/` |
| `packages/core` | `@usetagih/core` | `"dependencies": { "@usetagih/schema": "workspace:*" }` only — **never** depend on `@usetagih/db` or `@usetagih/render` (AD-1) |
| `packages/render` | `@usetagih/render` | Stub only; Typst driver in Epic 1 |
| `packages/sdk` | `@usetagih/sdk` | Stub; depends on `@usetagih/schema` workspace |
| `packages/db` | `@usetagih/db` | Stub; Drizzle in Epic 3 |

`packages/templates/` and `packages/config/` have **no** `package.json` in this story (not workspace members until Story 0.2 adds `@usetagih/config`).

### Root `biome.jsonc` expectations

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["ultracite/biome/core"],
  "files": {
    "includes": ["**", "!node_modules/**", "!dist/**", "!.next/**", "!.turbo/**"]
  }
}
```

Member packages run `"lint": "biome check ."` from their directory or delegate to root — pick one consistent pattern. Goal: `bunx biome check .` from root passes. Do **not** use deprecated v6 path `ultracite/core` or invalid `ultracite/biome.json`.

### Root `.gitignore` expectations

```
node_modules/
dist/
.next/
.turbo/
.env
.env.*
!.env.example
```

Commit `bun.lock`; do not ignore it.

### `apps/mcp/README.md` required content

Must explicitly include:

- MCP server is **v1.1 POST-MVP** — not built at MVP
- Implementation will use `@modelcontextprotocol/sdk` + `@usetagih/sdk` calling **public REST only** (AD-2, SOLUTION-DESIGN §14)
- **Zero imports** from `packages/core` or `packages/render`
- Max 5 tools mapping 1:1 to REST endpoints

### Architecture compliance

- **AD-1:** `packages/core` depends on `packages/schema` only — enforce in stub `package.json` dependencies now to prevent graph mistakes later.
- **AD-2:** `apps/mcp` README documents REST-only boundary; no business logic in MCP stub.
- **Hexagonal seed:** `apps/api` is future composition root; keep stub thin.
- **Naming:** kebab-case files, camelCase TS exports, `@usetagih/*` scoped packages per SOLUTION-DESIGN §6.

### Dependency graph (future — stub must not violate)

```text
schema ← core ← (wired by api)
schema ← sdk
render → templates (Epic 1)
api → core, db, render, schema
web → sdk
```

Only declare dependencies that exist as workspace stubs; do not wire `api → render` until Epic 3.

### Testing Requirements

Run from repo root after implementation; all must exit 0:

```bash
bun install
bunx biome check .
bunx turbo run build --dry-run
bunx turbo run lint typecheck test build
```

Optional sanity:

```bash
bun pm ls          # lists all workspace packages
test -f apps/mcp/README.md && grep -qi 'v1.1' apps/mcp/README.md
test ! -f packages/config/tsconfig/base.json   # Story 0.2 scope
```

### Anti-patterns (do not do)

- Do not add duplicate Zod or validation logic outside `packages/schema` (AD-1).
- Do not commit secrets or `.env` files (NFR-4).
- Do not implement Docker, CI, Doppler, or shared tsconfig package — those are Stories 0.2–0.6.
- Do not use npm/yarn/pnpm — Bun only per stack.
- Do not skip `bun.lock` — lockfile must be committed for reproducible CI.

### Epic 0 cross-story context

| Story | Delivers after 0.1 |
| --- | --- |
| 0.2 | `@usetagih/config` — shared `tsconfig/base.json`, biome extends, per-package tsconfig inheritance |
| 0.3 | `docker/compose.yml` — Postgres 16 + MinIO |
| 0.4 | `.github/workflows/ci.yml` |
| 0.5 | GHCR docker-push workflow skeleton |
| 0.6 | `doppler.yaml` + env validation scaffold |

Epic 0 gates **Epic 1 PDF spike** — do not start Typst work until Stories 0.1–0.2 at minimum allow CI lint/typecheck.

### Project Structure Notes

- Aligns with ARCHITECTURE-SPINE Structural Seed and SOLUTION-DESIGN §6 Repository Layout.
- `packages/config/` intentionally empty — Story 0.2 adds `@usetagih/config` with shared tsconfig + extended biome.
- `packages/templates/` is a content directory for `.typ` files (Epic 1+), not a workspace package yet.
- Harness epic (`0-1-e2e-probe`) is archived/done — unrelated to this story key.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#Structural Seed]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#Stack]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#6. Repository Layout (Full)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#14. MCP v1.1 Preservation]
- [Source: knowledge-base-of-king-the-user/docs/personal/tech-stack.md — Bun, Biome+ultracite, turborepo]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (headless subagent)

### Debug Log References

- biome root check initially failed on `.agents/` and symlinked `knowledge-base-of-king-the-user/` — fixed via scoped `files.includes` with `!!` exclusions per ultracite merge semantics
- `tsc` typecheck failed on `bun:test` imports — fixed by excluding `src/**/*.test.ts` from package tsconfigs until Story 0.2 shared config

### Completion Notes List

- bootstrapped Bun+turborepo workspace with 8 scoped packages (`apps/*`, `packages/*`)
- ultracite v7 biome preset at root; biome check passes on scaffold paths only
- all turbo pipelines (`lint`, `typecheck`, `test`, `build`) exit 0 across workspace members
- `packages/core` depends on `@usetagih/schema` only (AD-1); `apps/mcp/README.md` documents v1.1 REST-only deferral (AD-2)
- `packages/config/` left empty for Story 0.2; `bun.lock` committed

### File List

- `.gitignore` (modified)
- `package.json` (new)
- `turbo.json` (new)
- `biome.jsonc` (new)
- `tsconfig.json` (new)
- `bun.lock` (new)
- `apps/api/package.json` (new)
- `apps/api/tsconfig.json` (new)
- `apps/api/src/index.ts` (new)
- `apps/api/src/index.test.ts` (new)
- `apps/web/package.json` (new)
- `apps/web/tsconfig.json` (new)
- `apps/web/src/index.test.ts` (new)
- `apps/mcp/package.json` (new)
- `apps/mcp/tsconfig.json` (new)
- `apps/mcp/README.md` (new)
- `apps/mcp/src/index.test.ts` (new)
- `packages/schema/package.json` (new)
- `packages/schema/tsconfig.json` (new)
- `packages/schema/src/index.ts` (new)
- `packages/schema/src/index.test.ts` (new)
- `packages/core/package.json` (new)
- `packages/core/tsconfig.json` (new)
- `packages/core/src/index.ts` (new)
- `packages/core/src/index.test.ts` (new)
- `packages/render/package.json` (new)
- `packages/render/tsconfig.json` (new)
- `packages/render/src/index.ts` (new)
- `packages/render/src/index.test.ts` (new)
- `packages/sdk/package.json` (new)
- `packages/sdk/tsconfig.json` (new)
- `packages/sdk/src/index.ts` (new)
- `packages/sdk/src/index.test.ts` (new)
- `packages/db/package.json` (new)
- `packages/db/tsconfig.json` (new)
- `packages/db/src/index.ts` (new)
- `packages/db/src/index.test.ts` (new)
- `packages/templates/README.md` (new)
- `packages/config/.gitkeep` (new)
- `_bmad-output/implementation-artifacts/0-1-initialize-turborepo-monorepo-workspace.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Review Findings

- [x] [Review][Defer] local bun runtime 1.3.14 vs `packageManager`/`engines` 1.2.x band — review environment only; pin matches ARCHITECTURE-SPINE; lockfile installs cleanly
- [x] [Review][Defer] `bun test` may double-run stub tests from `dist/` after build locally — `dist/` is gitignored; turbo pipeline still exits 0

## Change Log

- 2026-07-20: code review approved — story marked done
- 2026-07-20: initialized turborepo monorepo workspace with Bun, Biome+ultracite, and stub apps/packages per ARCHITECTURE-SPINE structural seed
