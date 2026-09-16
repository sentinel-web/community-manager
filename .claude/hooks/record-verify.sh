#!/usr/bin/env bash
#
# PostToolUse(Bash) recorder — notes when verification commands pass, so the
# Stop gate (verify-gate.sh) can tell whether the current code state was checked.
#
# It records into <worktree>/.claude/.verify-state (gitignored), keyed by a tree
# signature of that working tree (HEAD sha + dirty-tree hash). Any new edit
# changes the signature and re-arms the gate. It is deliberately CONSERVATIVE:
#   - only a verification command in command position counts (`npm test`,
#     `npm run typecheck`, `tsc --noEmit`, `meteor test`) — not the same text
#     inside `echo`/`grep` arguments
#   - a check is credited only when its exit status decides the whole command's
#     status: nothing but `&&` may follow it, and it must not be piped onward
#     (`npm run typecheck || true; npm test` credits only `test`)
#   - it is credited to the one working tree it runs in (leading `cd … &&` or the
#     session cwd); when that is ambiguous, nothing is recorded
#   - the result must look green: an explicit non-zero exit_code, or any common
#     failure signal in the payload, means nothing is recorded
#
# Contract: always exit 0 (a recorder must never block a tool call).

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

CHECKS=$(analyze_payload "$INPUT" | awk -F '\t' '$1 == "CHECK" && $3 == "1" && $4 != "?" { print $2 "\t" $4 }')
[ -z "$CHECKS" ] && exit 0   # no creditable verification command — nothing to record

# --- Did it pass? ------------------------------------------------------------
if printf '%s' "$INPUT" | grep -qE '"(exit_code|exitCode)"[[:space:]]*:[[:space:]]*[1-9]'; then
  exit 0
fi
if printf '%s' "$INPUT" | grep -qE '"interrupted"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi
if printf '%s' "$INPUT" | grep -qiE 'error TS[0-9]|Found [0-9]+ errors?|[1-9][0-9]* failing|✗|not ok|tests? failed|FAIL |npm error|npm ERR!|command failed'; then
  exit 0
fi

# --- Record against each check's working tree --------------------------------
while IFS=$'\t' read -r CHECK DIR; do
  RESOLVED=$(resolve_dir "$DIR") || continue
  TOP=$(repo_top "$RESOLVED") || continue
  SIG=$(tree_sig "$TOP")
  [ -n "$SIG" ] || continue
  STATE_FILE=$(state_file "$TOP")

  mkdir -p "$(dirname "$STATE_FILE")"
  PREV_SIG=""
  [ -f "$STATE_FILE" ] && PREV_SIG=$(grep '^SIG=' "$STATE_FILE" 2>/dev/null | head -1 | cut -d= -f2-)

  # New code state: reset the record before adding this check.
  [ "$PREV_SIG" = "$SIG" ] || echo "SIG=$SIG" >"$STATE_FILE"
  grep -qx "$CHECK=1" "$STATE_FILE" 2>/dev/null || echo "$CHECK=1" >>"$STATE_FILE"
done <<<"$CHECKS"

exit 0
