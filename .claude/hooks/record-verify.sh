#!/usr/bin/env bash
#
# PostToolUse(Bash) recorder — notes when verification commands pass, so the
# Stop gate (verify-gate.sh) can tell whether the current code state was checked.
#
# It records into <worktree>/.claude/.verify-state (gitignored) keyed by a tree
# signature (HEAD sha + dirty-tree hash). The worktree is the one the command
# targets (leading `cd`, else the session cwd), so parallel worktree sessions
# each keep their own record. Any new edit changes the signature and re-arms the
# gate. It is deliberately CONSERVATIVE: it records a pass only when it is
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

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

CMD=$(payload_command "$INPUT")
[ -z "$CMD" ] && exit 0

# Which verifications does this command represent? A combined command such as
# `npm run typecheck && npm test` (what the gate asks for) counts as both.
CHECKS=""
if printf '%s' "$CMD" | grep -qE '(npm run typecheck|tsc[[:space:]]+--noEmit|tsc[[:space:]]+-p)'; then
  CHECKS="typecheck"
fi
if printf '%s' "$CMD" | grep -qE '(npm test|npm run test|meteor test)'; then
  CHECKS="$CHECKS test"
fi
[ -z "$CHECKS" ] && exit 0   # not a verification command — nothing to record

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

# --- Record against the target tree's signature ------------------------------
DIR=$(target_dir "$INPUT")
STATE_FILE=$(state_file "$DIR")
SIG="$(tree_sig "$DIR")"

mkdir -p "$(dirname "$STATE_FILE")"
PREV_SIG=""
[ -f "$STATE_FILE" ] && PREV_SIG=$(grep '^SIG=' "$STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2-)

# New code state: reset the record before adding this command's checks.
[ "$PREV_SIG" = "$SIG" ] || echo "SIG=$SIG" >"$STATE_FILE"

for CHECK in $CHECKS; do
  grep -qx "$CHECK=1" "$STATE_FILE" 2>/dev/null || echo "$CHECK=1" >>"$STATE_FILE"
done

exit 0
