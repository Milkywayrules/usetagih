---
baseline_commit: c6f738df6780cfb74c4925f0a6157ebd4c1b888a
---

# Story 0.3: local Docker Compose for Postgres and MinIO

Status: review

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a developer,
I want `docker/compose.yml` with Postgres 16 and MinIO,
so that API development can run against local DB and R2-compatible storage (SOLUTION-DESIGN §8).

## Acceptance Criteria

1. **Given** Stories 0.1–0.2 complete (turborepo + `@usetagih/config` landed), **when** `docker/compose.yml` is added per Dev Notes, **then** services `postgres`, `minio`, `createbuckets`, `api`, and `web` are declared with names, images/build targets, ports, volumes, and healthchecks exactly as specified in Dev Notes.
2. **Given** a reachable Docker daemon, **when** `docker compose -f docker/compose.yml up -d postgres minio createbuckets` runs from repo root (using `docker` or `docker.exe` per Environment Notes), **then** Postgres accepts connections on host port `5432` and MinIO S3 API on host port `9000`.
3. **Given** stack from AC 2 healthy, **when** bucket bootstrap completes, **then** MinIO bucket `usetagih-artifacts` exists (verified via `mc ls` one-shot container or MinIO console at `http://localhost:9001`).
4. **Given** `docker/compose.yml`, **when** the R2 emulation documentation block is read, **then** it lists every local dev variable from SOLUTION-DESIGN §8.3: `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_FORCE_PATH_STYLE=true`, plus companion `DATABASE_URL` for Postgres — with values matching compose credentials.
5. **Given** placeholder app services, **when** `docker/Dockerfile.api` and `docker/Dockerfile.web` are inspected, **then** each is a minimal alpine-based stub (`EXPOSE` `3001` / `3000` respectively) referenced by compose `build` contexts; they are **not** required to start for AC 2–3 verification.
6. **Given** compose uses alpine/minimal images (`postgres:16-alpine`, lightweight `minio/mc` for bootstrap), **when** images are pulled, **then** total footprint stays minimal (no debian/bookworm service images in this story).
7. **Given** Docker daemon unreachable at verification time, **when** static validation runs, **then** `docker compose -f docker/compose.yml config` (or `docker.exe compose …`) exits 0 — runtime bring-up ACs (2–3) are marked **environment-gated** and re-run when daemon is available.
8. **Given** existing turbo pipelines, **when** `bunx turbo run lint typecheck test build` runs from repo root after adding docker files, **then** all tasks still exit 0 (docker files must not break workspace scripts).
9. **Out of scope (Stories 0.4–0.6):** GitHub Actions CI, GHCR push workflows, production multi-stage Dockerfiles, Doppler `doppler.yaml`, env Zod schema, Elysia/Next.js runtime wiring — do not implement here.

## Tasks / Subtasks

- [x] Task 1 — Create `docker/compose.yml` (AC: 1, 4, 6)
  - [x] Add header comment documenting local `DATABASE_URL` + R2 emulation env vars (§8.3)
  - [x] Service `postgres`: image `postgres:16-alpine`, port `5432:5432`, env + volume + healthcheck per Dev Notes
  - [x] Service `minio`: image `minio/minio`, command `server /data --console-address ":9001"`, ports `9000:9000` and `9001:9001`, env + volume + healthcheck per Dev Notes
  - [x] Service `createbuckets`: image `minio/mc`, `depends_on` minio, one-shot entrypoint creating bucket `usetagih-artifacts`, `restart: "no"`
  - [x] Services `api` / `web`: `build` from `docker/Dockerfile.api` / `docker/Dockerfile.web` with `context: ..`, ports `3001:3001` / `3000:3000`, `depends_on` postgres (healthy) — may use compose `profiles: [apps]` so default `up` targets infra only
  - [x] Named volumes `postgres_data`, `minio_data`
- [x] Task 2 — Stub Dockerfiles for placeholder services (AC: 5)
  - [x] Create `docker/Dockerfile.api` — `alpine:3.21`, `EXPOSE 3001`, idle CMD (e.g. `sleep infinity`)
  - [x] Create `docker/Dockerfile.web` — `alpine:3.21`, `EXPOSE 3000`, idle CMD
  - [x] Do **not** add `docker/Dockerfile.render-ci` (Story 1.4 / 0.5 scope)
- [x] Task 3 — Verification gate (AC: 2–4, 7–8)
  - [x] Run static compose config parse (always required)
  - [x] If daemon reachable: `up -d postgres minio createbuckets`, verify ports + bucket
  - [x] Confirm `bunx turbo run lint typecheck test build` still green
  - [x] Document environment-gated results in Dev Agent Record if runtime checks skipped

## Dev Notes

### Goal

Add the **local infrastructure stack** per SOLUTION-DESIGN §8 so Epic 3 API work and Story 3.1 migrations can target compose Postgres, and R2 artifact uploads can be exercised against MinIO with `R2_FORCE_PATH_STYLE=true`. This unblocks Story 0.4 CI (which does not need compose yet) and Epic 3 integration tests that assume the stack exists.

### Current repo state (Stories 0.1–0.2 landed — do not re-bootstrap)

| Item | Current value | This story changes |
| --- | --- | --- |
| `docker/` | **absent** | add `compose.yml`, `Dockerfile.api`, `Dockerfile.web` |
| Root `package.json` | workspaces + turbo scripts; `packageManager` `bun@1.2.18` | unchanged (optional: add `compose:up` script — **not required**) |
| `@usetagih/api` | stub `tsc --outDir dist`; no HTTP server | compose `api` service is placeholder only |
| `@usetagih/web` | stub build writes `dist/.gitkeep` | compose `web` service is placeholder only |
| Turbo pipelines | lint/typecheck/test/build all green | must remain green after docker files added |

### Dev commands (SOLUTION-DESIGN §8.2)

Infra only (matches Epic AC):

```bash
# With Doppler dev config (Story 0.6 adds doppler.yaml — command shape is fixed now):
doppler run --config dev -- docker compose -f docker/compose.yml up -d postgres minio createbuckets

# Host-run apps (unchanged — turbo parallel dev):
doppler run --config dev -- bun run dev
```

Until Story 0.6 lands, `doppler run` requires a local Doppler CLI login — infra-only verification may omit the `doppler run` wrapper and invoke compose directly.

**Port conflicts:** if host Postgres or another service already binds `5432`/`9000`, stop it or remap ports in a local override file (`docker/compose.override.yml`, gitignored) — do not change committed default ports.

### Environment facts (WSL / Docker Desktop — do not guess)

| Fact | Value |
| --- | --- |
| Docker CLI (WSL) | Prefer `docker`; fall back to `docker.exe` (Docker Desktop WSL integration) |
| Compose | v5.x available (`docker compose`, not legacy `docker-compose` binary) |
| Daemon | May be starting asynchronously — static `compose config` must pass even when daemon is down |
| Disk pressure | Host `C:` nearly full — use **alpine** service images; avoid fat base images |

**Docker resolver helper** (use in all verification scripts):

```bash
resolve_docker() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo docker
  elif command -v docker.exe >/dev/null 2>&1 && docker.exe info >/dev/null 2>&1; then
    echo docker.exe
  else
    return 1
  fi
}
```

### Canonical local credentials (compose + documentation)

These are **local-dev-only** literals; production uses Doppler (NFR-4). Story 0.6 adds Zod validation — align names now.

| Variable | Local value | Used by |
| --- | --- | --- |
| `POSTGRES_USER` | `usetagih` | postgres service env |
| `POSTGRES_PASSWORD` | `usetagih_dev` | postgres service env |
| `POSTGRES_DB` | `usetagih` | postgres service env |
| `DATABASE_URL` | `postgresql://usetagih:usetagih_dev@localhost:5432/usetagih` | api/worker (document in compose header; Doppler `dev` later) |
| `MINIO_ROOT_USER` | `minioadmin` | minio service env |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | minio service env |
| `R2_ENDPOINT` | `http://localhost:9000` | api S3 client (§8.3) |
| `R2_BUCKET` | `usetagih-artifacts` | api artifact uploads |
| `R2_ACCESS_KEY_ID` | `minioadmin` | matches MinIO root user |
| `R2_SECRET_ACCESS_KEY` | `minioadmin` | matches MinIO root password |
| `R2_FORCE_PATH_STYLE` | `true` | required for MinIO; prod Cloudflare R2 omits forcing |

### Exact `docker/compose.yml` specification

File path: **`docker/compose.yml`** (compose v2+ format — no top-level `version:` key).

```yaml
# usetagih local stack — SOLUTION-DESIGN §8
#
# Local DATABASE_URL (host machine, api on host):
#   postgresql://usetagih:usetagih_dev@localhost:5432/usetagih
#
# R2 emulation (Doppler dev / host-run api — §8.3):
#   R2_ENDPOINT=http://localhost:9000
#   R2_BUCKET=usetagih-artifacts
#   R2_ACCESS_KEY_ID=minioadmin
#   R2_SECRET_ACCESS_KEY=minioadmin
#   R2_FORCE_PATH_STYLE=true
#
# Infra only:  docker compose -f docker/compose.yml up -d postgres minio createbuckets
# With stubs:  docker compose -f docker/compose.yml --profile apps up -d

services:
  postgres:
    image: postgres:16-alpine
    container_name: usetagih-postgres
    environment:
      POSTGRES_USER: usetagih
      POSTGRES_PASSWORD: usetagih_dev
      POSTGRES_DB: usetagih
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U usetagih -d usetagih"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  minio:
    image: minio/minio:RELEASE.2024-12-18T13-15-44Z
    container_name: usetagih-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  createbuckets:
    image: minio/mc:RELEASE.2024-12-18T13-15-44Z
    container_name: usetagih-createbuckets
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      mc mb --ignore-existing local/usetagih-artifacts &&
      mc ls local/usetagih-artifacts &&
      exit 0
      "
    restart: "no"

  api:
    profiles: ["apps"]
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    container_name: usetagih-api
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy

  web:
    profiles: ["apps"]
    build:
      context: ..
      dockerfile: docker/Dockerfile.web
    container_name: usetagih-web
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  minio_data:
```

**Notes on the spec:**

- Pin MinIO/mc tags to the same release train for reproducibility; patch bump OK if pull fails — record resolved tag in Dev Agent Record.
- `createbuckets` uses `service_healthy` on minio; if curl healthcheck fails on your MinIO build, switch minio `depends_on` in `createbuckets` to `service_started` and add `sleep 5` before `mc alias` (document in completion notes).
- `profiles: [apps]` keeps Epic AC command (`up -d postgres minio createbuckets`) from building stub app images; `--profile apps` opt-in matches SOLUTION-DESIGN §8.1 layout.

### Stub Dockerfiles (exact)

**`docker/Dockerfile.api`**

```dockerfile
# Stub placeholder — real Bun/Elysia image in Story 0.5 GHCR workflow / Epic 3
FROM alpine:3.21
EXPOSE 3001
CMD ["sleep", "infinity"]
```

**`docker/Dockerfile.web`**

```dockerfile
# Stub placeholder — real Next.js image in Story 0.5 GHCR workflow / Epic 6
FROM alpine:3.21
EXPOSE 3000
CMD ["sleep", "infinity"]
```

Story 0.5 expands these into GHCR-bound multi-stage builds; Story 1.4 adds `docker/Dockerfile.render-ci` separately.

### Architecture compliance

- **SOLUTION-DESIGN §8.1:** postgres `16-alpine`, minio ports 9000/9001, createbuckets → `usetagih-artifacts`, api `3001`, web `3000`.
- **SOLUTION-DESIGN §8.2:** dev flow starts infra via compose; app dev remains `doppler run --config dev -- bun run dev` on host (turbo) — compose app stubs optional via profile.
- **SOLUTION-DESIGN §8.3:** R2 emulation env block documented in compose header with `R2_FORCE_PATH_STYLE=true`.
- **ARCHITECTURE-SPINE structural seed:** `docker/compose.yml` + Dockerfile stubs at `docker/Dockerfile.{api,web}`.
- **NFR-4:** credentials are local-dev literals in compose comments/env — not production secrets; no Doppler tokens in repo.

### Previous story intelligence (0.2)

- Nine workspace members including `@usetagih/config`; `packages/templates/` stays non-workspace.
- Biome excludes `_bmad-output` — docker files under `docker/` are linted if added to biome includes (root `packages/config/biome.json` includes repo root paths; `docker/**` not excluded).
- Turbo `typecheck`/`test` depend on `^build` — adding docker files must not alter package graphs.
- `${configDir}` pattern in shared tsconfigs — unrelated to docker; do not touch tsconfig in this story.

### Git intelligence (recent commits)

| Commit | Relevance |
| --- | --- |
| `c6f738d` | story 0-2 done — baseline for `baseline_commit` |
| `7e31fdd` | shared config package landed — turbo green baseline |
| `404d0f0` | monorepo scaffold — stub apps exist for compose placeholders |

### Testing Requirements

Run from repo root.

#### Static (always required — daemon optional)

```bash
DOCKER=$(resolve_docker) || DOCKER=docker  # fall back for config-only parse
$DOCKER compose -f docker/compose.yml config --quiet
test -f docker/compose.yml
test -f docker/Dockerfile.api
test -f docker/Dockerfile.web
grep -q 'R2_FORCE_PATH_STYLE=true' docker/compose.yml
grep -q 'usetagih-artifacts' docker/compose.yml
grep -q 'postgres:16-alpine' docker/compose.yml
```

#### Runtime (environment-gated — skip with note if `resolve_docker` fails)

```bash
DOCKER=$(resolve_docker) || { echo "SKIP runtime ACs — daemon unavailable"; exit 0; }

$DOCKER compose -f docker/compose.yml down -v --remove-orphans 2>/dev/null || true
$DOCKER compose -f docker/compose.yml up -d postgres minio createbuckets

# Postgres ready
$DOCKER compose -f docker/compose.yml exec -T postgres pg_isready -U usetagih -d usetagih

# MinIO S3 port (host)
command -v nc >/dev/null && nc -z localhost 9000

# Bucket exists
$DOCKER run --rm --network container:usetagih-minio minio/mc:RELEASE.2024-12-18T13-15-44Z \
  sh -c "mc alias set local http://127.0.0.1:9000 minioadmin minioadmin && mc ls local/usetagih-artifacts"

$DOCKER compose -f docker/compose.yml down
```

#### Workspace regression (always required)

```bash
bunx turbo run lint typecheck test build
```

### Anti-patterns (do not do)

- Do **not** add `.github/workflows/` (Story 0.4).
- Do **not** add `doppler.yaml` or Zod env schema (Story 0.6).
- Do **not** implement Elysia HTTP server or Next.js in Dockerfiles — stubs only.
- Do **not** add `docker/Dockerfile.render-ci` — Epic 1 / Story 1.4.
- Do **not** use `docker-compose` v1 binary — Compose v5 plugin only.
- Do **not** commit `.env` files with secrets — document vars in compose header only.
- Do **not** use debian/ubuntu-based service images for postgres/minio/mc in this story.

### Epic 0 cross-story context

| Story | Relationship |
| --- | --- |
| 0.4 | CI runs turbo tasks — must stay green; no compose in CI yet |
| 0.5 | GHCR workflow builds `docker/Dockerfile.api/web/render-ci` — stubs must exist first |
| 0.6 | `doppler.yaml` + env schema references `DATABASE_URL`, `R2_*` documented here |
| 3.1 | `bun run --filter @usetagih/db migrate` targets compose Postgres |
| 3.17 | integration test assumes compose stack |

### Project Structure Notes

```text
docker/
├── compose.yml           # NEW — primary deliverable
├── Dockerfile.api        # NEW — alpine stub (Story 0.5 replaces)
└── Dockerfile.web        # NEW — alpine stub (Story 0.5 replaces)
```

Compose `build.context: ..` resolves to repo root from `docker/compose.yml` path.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.3]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#8. Local Development]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/SOLUTION-DESIGN.md#8.3 MinIO as R2 Emulation]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-usetagih-2026-07-20/ARCHITECTURE-SPINE.md#Structural Seed]
- [Source: _bmad-output/implementation-artifacts/0-2-shared-typescript-and-biome-config-package.md — turbo baseline, out-of-scope fence]

## Dev Agent Record

### Agent Model Used

Composer 2.5 (headless subagent)

### Debug Log References

- `minio/mc:RELEASE.2024-12-18T13-15-44Z` not published on Docker Hub; resolved to `RELEASE.2024-11-21T17-21-54Z` (nearest prior mc release)

### Completion Notes List

- Added `docker/compose.yml` with postgres 16-alpine, minio, createbuckets one-shot, and api/web stubs behind `apps` profile
- Header documents `DATABASE_URL` and all R2 emulation vars per SOLUTION-DESIGN §8.3
- Static `docker compose config --quiet` passed; runtime: postgres healthy on 5432, minio on 9000, bucket `usetagih-artifacts` created (createbuckets exit 0)
- `bunx turbo run lint typecheck test build` — 36/36 tasks green
- Stack torn down after verification; named volumes retained

### File List

- docker/compose.yml (new)
- docker/Dockerfile.api (new)
- docker/Dockerfile.web (new)
- _bmad-output/implementation-artifacts/0-3-local-docker-compose-for-postgres-and-minio.md (updated)
- _bmad-output/implementation-artifacts/sprint-status.yaml (updated)

## Story Validation Record

| Check | Result |
| --- | --- |
| Epic 0.3 AC coverage (postgres, minio, createbuckets, R2 docs, api/web stubs) | PASS |
| SOLUTION-DESIGN §8.1 service matrix (images, ports, bucket name) | PASS |
| SOLUTION-DESIGN §8.3 R2 emulation vars incl. `R2_FORCE_PATH_STYLE=true` | PASS |
| WSL `docker` / `docker.exe` fallback + static `compose config` gate | PASS |
| Environment-gated runtime ACs when daemon unavailable | PASS |
| Alpine/minimal image constraint | PASS |
| Stories 0.1–0.2 context + out-of-scope fence (0.4–0.6) | PASS |
| Zero-guess file paths, credentials, verification commands | PASS |

## Change Log

- 2026-07-20: story created and validated — ready for dev
- 2026-07-20: implemented local docker compose stack — postgres, minio, bucket bootstrap, stub app services
