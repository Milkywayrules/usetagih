# @usetagih/render

PDF render harness and golden determinism checks for the usetagih monorepo.

- Typst version pin: `typst-version.txt`
- Fixture manifest and checksums: `manifest.json`
- Authoritative CI image: `docker/Dockerfile.render-ci`

## Golden checks: local vs CI

- **Authoritative:** `golden:check` inside the pinned `docker/Dockerfile.render-ci` image (linux/amd64), enforced by `.github/workflows/pdf-golden.yml`.
- **Advisory:** running `bun run --filter @usetagih/render golden:check` on the host (WSL/macOS/other Typst builds) may produce different PDF bytes due to platform/Typst build variance (see SOLUTION-DESIGN §3.2, typst/typst#7683). Use local runs for fast feedback only — merge gate is CI Docker.
- **Update golden hashes** only after visual review, inside CI Docker via `golden:update`, with PR label `golden-update`.
