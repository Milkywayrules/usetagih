# Mandatory human input / actions

## FYI — veto window (agent proceeds unless you object)

- [ ] **pino → evlog supersession**: your directive #5c (evlog) conflicts with the ratified architecture spine (pino, Story 8.6). The right-hand board voted unanimously to adopt **evlog** (maturity independently verified: v2.x, first-party Elysia plugin, drain pipeline, OTLP adapter) and amend Story 8.6 + spine accordingly, preserving the exact log field contract and metric names. Veto here if you actually want pino kept.

## Answered/processed by agent (no action needed)

- Directive #5 (elysia: openapi+scalar, otel, evlog, envelope, helmet) — board ratified unanimously; docs exposure = hybrid (dev/staging on, production fail-closed until launch gate, then public unauthenticated); encoded into sprint via correct-course amendment.
- **C: drive 100% full** — King resolved (space reclaimed; Docker VHDX / disk freed). Cursor state-store corruption risk mitigated for this session.
- **Docker CLI segfault / Postgres integration gate** — resolved: `docker version` OK from WSL; `docker compose -f docker/compose.yml up -d postgres` healthy; Story 3.5 integration tests ran (100 pass, 0 skip for integration suites) and sprint marked done.

