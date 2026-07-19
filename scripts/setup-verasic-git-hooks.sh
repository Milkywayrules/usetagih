#!/usr/bin/env bash
# wire verasic commit-msg hook — strips injected co-authored trailers before commit write
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
HOOKS="${ROOT}/.cursor/skills/verasic-git-commits/hooks"
if [[ ! -x "${HOOKS}/commit-msg" ]]; then
  echo "missing executable hook: ${HOOKS}/commit-msg" >&2
  exit 1
fi
git config core.hooksPath "${HOOKS}"
echo "core.hooksPath -> ${HOOKS}"
