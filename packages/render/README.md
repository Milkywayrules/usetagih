# @usetagih/render

PDF render harness and golden determinism checks for the usetagih monorepo.

- Typst version pin: `typst-version.txt`
- Fixture manifest and checksums: `manifest.json`
- Authoritative CI image: `docker/Dockerfile.render-ci`

## Golden checks: local vs CI

- **Authoritative:** `golden:check` inside the pinned `docker/Dockerfile.render-ci` image (linux/amd64), enforced by `.github/workflows/pdf-golden.yml`.
- **Advisory:** running `bun run --filter @usetagih/render golden:check` on the host (WSL/macOS/other Typst builds) may produce different PDF bytes due to platform/Typst build variance (see SOLUTION-DESIGN §3.2, typst/typst#7683). Use local runs for fast feedback only — merge gate is CI Docker.
- **Update golden hashes** only after visual review, inside CI Docker via `golden:update`, with PR label `golden-update`.

## Spike gate (Epic 1 exit)

Epic 1 blocks all feature epics until the PDF pipeline spike passes in authoritative CI Docker (AD-10).

- **Artifact:** `SPIKE-RESULT.md` — verdict, toolchain pins, manifest snapshot, soak baselines.
- **Check:** `bun run --filter @usetagih/render spike:gate` — reads `status:` line; exit 0 on PASS, exit 1 on FAIL with halt message.

| Verdict | Action |
| --- | --- |
| **PASS** | Epics 2+ unblocked |
| **FAIL** | Stop Epics 2–8; reopen PDF engine decision at board; **no Chromium or pixel-golden fallback** |

Local `golden:check` outside CI Docker remains advisory (see above). SPIKE-RESULT records local-container evidence until first GitHub CI run confirms pdf-golden.yml.
