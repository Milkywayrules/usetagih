# Mandatory human input / actions

## URGENT — C: drive 100% full (1 GB free) — this is what killed the last two chats

Cursor's state store lives on C:; when it fills, the chat DB corrupts ("missing blobs"). Agent-side cleanup cannot fix this because the space is held by VHDX files that only shrink from Windows.

- [ ] Reclaim Docker Desktop disk (biggest win — `C:\Users\user\AppData\Local\Docker\wsl\disk\docker_data.vhdx` is **36 GB**):
  1. In Docker Desktop → Troubleshoot → "Clean / Purge data", or run `docker system prune -a` for unused images/build cache first (keep the `usetagih` Postgres volume!)
  2. Then compact: quit Docker Desktop, `wsl --shutdown`, then in admin PowerShell: `Optimize-VHD -Path "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx" -Mode Full` (needs Hyper-V module; alternative: `diskpart` → `select vdisk file=...` → `compact vdisk`)
  3. Better long-term: Docker Desktop → Settings → Resources → Advanced → move "Disk image location" to a bigger drive
- [ ] Optional: Cursor roaming data is 5.6 GB (`C:\Users\user\AppData\Roaming\Cursor`) — old workspaceStorage/Cache can be trimmed from within Cursor or manually
- [ ] Consider moving the Cursor user-data dir or freeing another ~10 GB headroom so this stops recurring

## Answered/processed by agent (no action needed)

- (none pending)
