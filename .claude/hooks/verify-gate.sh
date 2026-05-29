#!/usr/bin/env bash
#
# Stop gate — refuses to let the agent finish a turn when the current feature
# branch has SOURCE changes that have not passed typecheck + tests.
#
# It reads the marker written by record-verify.sh. The marker is keyed to a
# tree signature, so any edit since the last green run re-arms the gate.
#
# Scope guards (keep it low-friction):
#   - inactive on the default branch (commits there are blocked anyway)
#   - inactive when no source files changed vs the default branch / working tree
#   - bypass entirely with CLAUDE_SKIP_VERIFY_GATE=1
#
# Contract: exit 0 = allow stop, exit 2 = block (stderr shown to the agent).
# Guards against infinite loops: if the agent is stopping *because* a prior
# stop hook already blocked, Claude Code passes stop_hook_active=true.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

[ "${CLAUDE_SKIP_VERIFY_GATE:-}" = "1" ] && exit 0

INPUT=$(cat)
# Avoid stop-hook loops: Claude Code sets stop_hook_active when re-stopping
# after a prior Stop-hook block. Matched on the raw payload (no jq dependency).
if printf '%s' "$INPUT" | grep -qE '"stop_hook_active":[[:space:]]*true'; then
  exit 0
fi

STATE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/.verify-state"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ -z "$BRANCH" ] && exit 0
{ [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; } && exit 0

# Source files changed on this branch: committed vs main + staged + unstaged +
# untracked (new files don't appear in `git diff`, so list them explicitly).
BASE=$(git merge-base main HEAD 2>/dev/null || echo "")
CHANGED=$(
  {
    [ -n "$BASE" ] && git diff --name-only "$BASE"...HEAD 2>/dev/null
    git diff --name-only 2>/dev/null
    git diff --cached --name-only 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | sort -u | grep -E '^(imports|server|client|tests|e2e)/|^[^/]+\.ts$' || true
)
[ -z "$CHANGED" ] && exit 0   # no source changes — nothing to gate

# Has the current code state passed both checks?
SIG="$(tree_sig)"
MARK_SIG=""
[ -f "$STATE_FILE" ] && MARK_SIG=$(grep '^SIG=' "$STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2-)

if [ "$MARK_SIG" = "$SIG" ] \
   && grep -qx 'typecheck=1' "$STATE_FILE" 2>/dev/null \
   && grep -qx 'test=1' "$STATE_FILE" 2>/dev/null; then
  exit 0
fi

echo "BLOCKED by .claude/hooks/verify-gate.sh: branch '$BRANCH' has source changes that have not passed verification for the current code state." >&2
echo "Run both, then they will be recorded automatically:" >&2
echo "    npm run typecheck && npm test" >&2
echo "To finish without verifying (not recommended), set CLAUDE_SKIP_VERIFY_GATE=1." >&2
exit 2
