#!/usr/bin/env bash
#
# PostToolUse(Bash) recorder — notes when verification commands pass, so the
# Stop gate (verify-gate.sh) can tell whether the current code state was checked.
#
# It records into .claude/.verify-state (gitignored) keyed by a tree signature
# (HEAD sha + dirty-tree hash). Any new edit changes the signature and re-arms
# the gate. It is deliberately CONSERVATIVE: it records a pass only when it is
# confident, so the gate can never be falsely satisfied.
#
# The tool-call JSON arrives on stdin (command in .tool_input.command, result in
# .tool_response). We match the raw payload with grep to avoid a jq/node
# dependency. Pass detection, in order of preference:
#   1. an explicit non-zero exit_code/exitCode  -> fail
#      an explicit zero exit_code/exitCode       -> pass
#   2. fallback: no failure tokens in the payload -> pass
#
# Contract: always exit 0 (a recorder must never block a tool call).

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

STATE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/.verify-state"

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

# Which verification does this command represent?
CHECK=""
if printf '%s' "$INPUT" | grep -qE '(npm run typecheck|tsc[[:space:]]+--noEmit|tsc[[:space:]]+-p)'; then
  CHECK="typecheck"
elif printf '%s' "$INPUT" | grep -qE '(npm test|npm run test|meteor test)'; then
  CHECK="test"
fi
[ -z "$CHECK" ] && exit 0   # not a verification command — nothing to record

# --- Did it pass? ------------------------------------------------------------
PASSED="unknown"
if printf '%s' "$INPUT" | grep -qE '"(exit_code|exitCode)":[[:space:]]*[1-9]'; then
  PASSED="no"
elif printf '%s' "$INPUT" | grep -qE '"(exit_code|exitCode)":[[:space:]]*0'; then
  PASSED="yes"
fi
if [ "$PASSED" = "unknown" ]; then
  # Fallback: scan the whole payload for common failure signals.
  if printf '%s' "$INPUT" | grep -qiE 'error TS[0-9]|[0-9]+ failing|✗|not ok|tests? failed|FAIL |npm error|command failed'; then
    PASSED="no"
  else
    PASSED="yes"
  fi
fi
[ "$PASSED" = "yes" ] || exit 0

# --- Record against the current tree signature -------------------------------
SIG="$(tree_sig)"

mkdir -p "$(dirname "$STATE_FILE")"
PREV_SIG=""
[ -f "$STATE_FILE" ] && PREV_SIG=$(grep '^SIG=' "$STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2-)

if [ "$PREV_SIG" = "$SIG" ]; then
  # Same code state: add this check if not already present.
  grep -qx "$CHECK=1" "$STATE_FILE" 2>/dev/null || echo "$CHECK=1" >>"$STATE_FILE"
else
  # New code state: reset the record.
  { echo "SIG=$SIG"; echo "$CHECK=1"; } >"$STATE_FILE"
fi

exit 0
