# Mandatory human input / actions

## URGENT — C: drive 100% full (1 GB free) — this is what killed the last two chats

Cursor's state store lives on C:; when it fills, the chat DB corrupts ("missing blobs"). Agent-side cleanup cannot fix this because the space is held by VHDX files that only shrink from Windows.

- [ ] Reclaim Docker Desktop disk (biggest win — `C:\Users\user\AppData\Local\Docker\wsl\disk\docker_data.vhdx` is **36 GB**):
  1. In Docker Desktop → Troubleshoot → "Clean / Purge data", or run `docker system prune -a` for unused images/build cache first (keep the `usetagih` Postgres volume!)
  2. Then compact: quit Docker Desktop, `wsl --shutdown`, then in admin PowerShell: `Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx" -Mode Full` (needs Hyper-V module; alternative: `diskpart` → `select vdisk file=...` → `compact vdisk`)
  3. Better long-term: Docker Desktop → Settings → Resources → Advanced → move "Disk image location" to a bigger drive
- [ ] Optional: Cursor roaming data is 5.6 GB (`C:\Users\user\AppData\Roaming\Cursor`) — old workspaceStorage/Cache can be trimmed from within Cursor or manually
- [ ] Consider moving the Cursor user-data dir or freeing another ~10 GB headroom so this stops recurring

## URGENT — Docker CLI segfault (exit 139) blocks Story 3.5

Story 3.5 integration verification cannot finish until `docker` works from WSL (Postgres via compose; integration tests must run, not skip). Exit 139 often correlates with a full C: drive or a wedged Docker Desktop backend — see the section above for VHDX reclaim.

- [ ] Confirm Docker Desktop is running on Windows (system tray whale icon)
- [ ] If C: is still ~100% full, reclaim space first (existing Docker VHDX compact steps) — Docker often segfaults / fails when the host disk is full
- [ ] Restart Docker Desktop after reclaiming space; from WSL verify: `docker version` and `docker compose -f docker/compose.yml up -d postgres` succeed
- [ ] Notify agent / leave a note when Postgres is healthy so Story 3.5 review can finish (integration tests must run, not skip)

## FYI — veto window (agent proceeds unless you object)

- [ ] **pino → evlog supersession**: your directive #5c (evlog) conflicts with the ratified architecture spine (pino, Story 8.6). The right-hand board voted unanimously to adopt **evlog** (maturity independently verified: v2.x, first-party Elysia plugin, drain pipeline, OTLP adapter) and amend Story 8.6 + spine accordingly, preserving the exact log field contract and metric names. Veto here if you actually want pino kept.

## Answered/processed by agent (no action needed)

- Directive #5 (elysia: openapi+scalar, otel, evlog, envelope, helmet) — board ratified unanimously; docs exposure = hybrid (dev/staging on, production fail-closed until launch gate, then public unauthenticated); encoded into sprint via correct-course amendment.
