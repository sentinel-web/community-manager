#!/usr/bin/env bash
#
# Self-contained tests for the hooks in this directory. Builds a throwaway git
# repository with a feature-branch worktree and feeds the hooks synthetic
# Claude Code payloads.
#
# Usage: .claude/hooks/test-hooks.sh            # test the hooks next to this script
#        HOOKS_DIR=/path/to/hooks test-hooks.sh # test another copy (e.g. main's)

set -uo pipefail

HOOKS_DIR="${HOOKS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# --- Fixture: primary checkout on main + two feature worktrees ---------------
MAIN="$TMP/repo"
WT="$TMP/repo/.claude/worktrees/feat"
WT2="$TMP/repo/.claude/worktrees/feat2"
{
  git init -q -b main "$MAIN"
  git -C "$MAIN" config user.email test@example.com
  git -C "$MAIN" config user.name test
  mkdir -p "$MAIN/imports"
  printf '.claude/worktrees/\n.claude/.verify-state\n' >"$MAIN/.gitignore"
  echo "export const a = 1;" >"$MAIN/imports/a.ts"
  git -C "$MAIN" add -A
  git -C "$MAIN" commit -qm init
  git -C "$MAIN" worktree add -q -b feature/one "$WT" main
  git -C "$MAIN" worktree add -q -b feature/two "$WT2" main
  echo "export const b = 2;" >"$WT/imports/b.ts"
  echo "export const c = 3;" >"$WT2/imports/c.ts"
} >/dev/null 2>&1

export CLAUDE_PROJECT_DIR="$MAIN"

# payload <cwd> <command> [extra json fields] — JSON-escapes the command.
payload() {
  local cmd=${2//\\/\\\\}
  cmd=${cmd//\"/\\\"}
  printf '{"session_id":"t","cwd":"%s","hook_event_name":"x","tool_name":"Bash","tool_input":{"command":"%s"}%s}' "$1" "$cmd" "${3:-}"
}

# expect <name> <expected exit> <hook> <payload>
expect() {
  local name="$1" want="$2" hook="$3" input="$4" got
  # Run from the primary checkout (on main), as Claude Code does: hooks must
  # resolve the target tree from the payload, not from their own cwd.
  (cd "$MAIN" && printf '%s' "$input" | "$HOOKS_DIR/$hook" >/dev/null 2>&1)
  got=$?
  if [ "$got" = "$want" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $name (exit $got, expected $want)"
  fi
}

# expect_true <name> <shell condition>
expect_true() {
  if eval "$2"; then PASS=$((PASS + 1)); else FAIL=$((FAIL + 1)); echo "FAIL: $1"; fi
}

record() { (cd "$MAIN" && printf '%s' "$1" | "$HOOKS_DIR/record-verify.sh" >/dev/null 2>&1); }

# --- block-dangerous-git.sh ---------------------------------------------------
G=block-dangerous-git.sh
expect "commit on main (session cwd) is blocked"          2 $G "$(payload "$MAIN" 'git commit -m x')"
expect "push on main (session cwd) is blocked"            2 $G "$(payload "$MAIN" 'git push origin main')"
expect "commit via git -C worktree is allowed"            0 $G "$(payload "$MAIN" "git -C $WT commit -m x")"
expect "commit via quoted git -C worktree is allowed"     0 $G "$(payload "$MAIN" "git -C \"$WT\" commit -m x")"
expect "commit after cd worktree is allowed"              0 $G "$(payload "$MAIN" "cd $WT && git add -A && git commit -m x")"
expect "commit with worktree session cwd is allowed"      0 $G "$(payload "$WT" 'git commit -m x')"
expect "commit via relative git -C worktree is allowed"   0 $G "$(payload "$MAIN" 'git -C .claude/worktrees/feat commit -m x')"
expect "commit via git -C main from worktree is blocked"  2 $G "$(payload "$WT" "git -C $MAIN commit -m x")"
expect "reset --hard is blocked"                          2 $G "$(payload "$WT" 'git reset --hard')"
expect "escape hatch allows reset --hard"                 0 $G "$(payload "$WT" 'ALLOW_DANGEROUS_GIT=1 git reset --hard')"
expect "non-git command is allowed"                       0 $G "$(payload "$MAIN" 'ls -la')"

# --- record-verify.sh + verify-gate.sh ----------------------------------------
V=verify-gate.sh
OK=',"tool_response":{"stdout":"ok","exit_code":0}'
BAD=',"tool_response":{"stdout":"1 failing","exit_code":1}'

expect "gate is inactive on main"                          0 $V "$(payload "$MAIN" '')"
expect "gate blocks unverified worktree changes"           2 $V "$(payload "$WT" '')"

record "$(payload "$MAIN" "cd $WT && npm run typecheck && npm test" "$BAD")"
expect "failed run records nothing"                        2 $V "$(payload "$WT" '')"

record "$(payload "$MAIN" "cd $WT && npm run typecheck" "$OK")"
expect "typecheck alone does not satisfy the gate"         2 $V "$(payload "$WT" '')"

record "$(payload "$MAIN" "cd $WT && npm run typecheck && npm test" "$OK")"
expect "combined command records both checks"              0 $V "$(payload "$WT" '')"
expect_true "state is stored in the worktree" "[ -f '$WT/.claude/.verify-state' ]"
expect_true "no state is written to the primary checkout" "[ ! -f '$MAIN/.claude/.verify-state' ]"

record "$(payload "$WT2" 'npm run typecheck && npm test' "$OK")"
expect "a parallel worktree does not clobber the record"   0 $V "$(payload "$WT" '')"
expect "the parallel worktree has its own record"          0 $V "$(payload "$WT2" '')"

echo "export const b = 22;" >"$WT/imports/b.ts"
expect "an edit re-arms the gate"                          2 $V "$(payload "$WT" '')"

record "$(payload "$WT" 'npm run typecheck' "$OK")"
record "$(payload "$WT" 'meteor test --once --driver-package meteortesting:mocha' "$OK")"
expect "separate typecheck + test runs satisfy the gate"   0 $V "$(payload "$WT" '')"

echo "export const c = 33;" >"$WT2/imports/c.ts"
expect "stop_hook_active short-circuits the gate"          0 $V '{"cwd":"'"$WT2"'","stop_hook_active":true}'

echo
echo "hooks: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
