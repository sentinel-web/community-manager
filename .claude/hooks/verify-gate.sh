#!/usr/bin/env bash
#
# Stop gate — refuses to let the agent finish a turn when the working tree the
# session is in has SOURCE changes on a feature branch that have not passed
# typecheck + tests.
#
# It reads the marker written by record-verify.sh for that working tree
# (<toplevel>/.claude/.verify-state). The marker is keyed to a tree signature, so
# any edit since the last green run re-arms the gate.
#
# Scope guards (keep it low-friction):
#   - the working tree is the session cwd's (payload `cwd`, else $PWD); work done
#     elsewhere via `cd <other> && …` is not gated
#   - inactive outside a git working tree and on the default branch
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

CWD=$(analyze_payload "$INPUT" | awk -F '\t' '$1 == "CWD" { print $2; exit }')
RESOLVED=$(resolve_dir "${CWD:-$PWD}") || exit 0
TOP=$(repo_top "$RESOLVED") || exit 0
STATE_FILE=$(state_file "$TOP")

BRANCH=$(git -C "$TOP" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ -z "$BRANCH" ] && exit 0
{ [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; } && exit 0

# Source files changed on this branch: committed vs main + staged + unstaged +
# untracked (new files don't appear in `git diff`, so list them explicitly).
BASE=$(git -C "$TOP" merge-base main HEAD 2>/dev/null || echo "")
CHANGED=$(
  {
    [ -n "$BASE" ] && git -C "$TOP" diff --name-only "$BASE"...HEAD 2>/dev/null
    git -C "$TOP" diff --name-only 2>/dev/null
    git -C "$TOP" diff --cached --name-only 2>/dev/null
    git -C "$TOP" ls-files --others --exclude-standard 2>/dev/null
  } | sort -u | grep -E '^(imports|server|client|tests|e2e)/|^[^/]+\.ts$' || true
)
[ -z "$CHANGED" ] && exit 0   # no source changes — nothing to gate

# Has the current code state passed both checks?
SIG="$(tree_sig "$TOP")"
MARK_SIG=""
[ -f "$STATE_FILE" ] && MARK_SIG=$(grep '^SIG=' "$STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2-)

if [ -n "$SIG" ] && [ "$MARK_SIG" = "$SIG" ] \
   && grep -qx 'typecheck=1' "$STATE_FILE" 2>/dev/null \
   && grep -qx 'test=1' "$STATE_FILE" 2>/dev/null; then
  exit 0
fi

echo "BLOCKED by .claude/hooks/verify-gate.sh: branch '$BRANCH' has source changes that have not passed verification for the current code state." >&2
echo "Run both, then they will be recorded automatically:" >&2
echo "    npm run typecheck && npm test" >&2
echo "To finish without verifying (not recommended), set CLAUDE_SKIP_VERIFY_GATE=1." >&2
exit 2
