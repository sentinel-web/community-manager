#!/usr/bin/env bash
#
# Self-contained tests for the hooks in this directory. Builds a throwaway git
# repository (primary checkout on main + feature worktrees) and feeds the hooks
# synthetic Claude Code payloads, running them from the primary checkout as
# Claude Code does.
#
# Usage: .claude/hooks/test-hooks.sh            # test the hooks next to this script
#        HOOKS_DIR=/path/to/hooks test-hooks.sh # test another copy (e.g. main's)

set -uo pipefail

HOOKS_DIR="${HOOKS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
TMP=$(cd "$TMP" && pwd -P)

PASS=0
FAIL=0

# --- Fixture ------------------------------------------------------------------
MAIN="$TMP/repo"
WT="$MAIN/.claude/worktrees/feat"
WT2="$MAIN/.claude/worktrees/feat2"
SP="$MAIN/.claude/worktrees/wt dir"
NONGIT="$TMP/nongit"
{
  git init -q "$MAIN"
  git -C "$MAIN" symbolic-ref HEAD refs/heads/main
  git -C "$MAIN" config user.email test@example.com
  git -C "$MAIN" config user.name test
  mkdir -p "$MAIN/imports" "$NONGIT"
  printf '.claude/worktrees/\n.claude/.verify-state\n' >"$MAIN/.gitignore"
  echo "export const a = 1;" >"$MAIN/imports/a.ts"
  git -C "$MAIN" add -A
  git -C "$MAIN" commit -qm init
  git -C "$MAIN" worktree add -q -b feature/one "$WT" main
  git -C "$MAIN" worktree add -q -b feature/two "$WT2" main
  git -C "$MAIN" worktree add -q -b feature/sp "$SP" main
  mkdir -p "$WT2/client"
  echo "export const b = 2;" >"$WT/imports/b.ts"
  echo "export const c = 3;" >"$WT2/imports/c.ts"
} >/dev/null 2>&1

export CLAUDE_PROJECT_DIR="$MAIN"

# Words assembled at runtime so this file's own text never trips the live guard.
COMMIT="com""mit"
PUSH="pu""sh"
RESET="re""set"

json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

# payload <cwd> <command> [extra json fields]
payload() {
  printf '{"session_id":"t","cwd":"%s","hook_event_name":"x","tool_name":"Bash","tool_input":{"command":"%s","description":"d"}%s}' \
    "$(json_escape "$1")" "$(json_escape "$2")" "${3:-}"
}

# expect <name> <expected exit> <hook> <payload>
expect() {
  local name="$1" want="$2" hook="$3" input="$4" got
  (cd "$MAIN" && printf '%s' "$input" | "$HOOKS_DIR/$hook" >/dev/null 2>&1)
  got=$?
  if [ "$got" = "$want" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $name (exit $got, expected $want)"
  fi
}

expect_true() {
  if eval "$2"; then PASS=$((PASS + 1)); else FAIL=$((FAIL + 1)); echo "FAIL: $1"; fi
}

record() { (cd "$MAIN" && printf '%s' "$1" | "$HOOKS_DIR/record-verify.sh" >/dev/null 2>&1); }

G=block-dangerous-git.sh
allow() { expect "allow: [${1#"$TMP"/}] $2" 0 $G "$(payload "$1" "$2")"; }
block() { expect "block: [${1#"$TMP"/}] $2" 2 $G "$(payload "$1" "$2")"; }

# --- Guard: legitimate work is allowed ---------------------------------------
allow "$WT"   "git $COMMIT -m x"
allow "$MAIN" "git -C $WT $COMMIT -m x"
allow "$MAIN" "git -C \"$WT\" $COMMIT -m x"
allow "$MAIN" "git -C .claude/worktrees/feat $COMMIT -m x"
allow "$MAIN" "cd $WT && git add -A && git $COMMIT -m x"
allow "$MAIN" "cd \"$SP\" && git $COMMIT -m x"
allow "$MAIN" "git -C \"$SP\" $COMMIT -m x"
allow "$MAIN" "(cd $WT && git $COMMIT -m x)"
allow "$MAIN" "cd $WT && git $COMMIT -F - <<'EOF'
Message that mentions git $PUSH origin main; cd $MAIN && git $COMMIT
EOF"
allow "$WT"   "git $COMMIT -m \"\$(cat <<'EOF'
Fix (thing) - see git $PUSH origin main
1) unbalanced paren
EOF
)\""
allow "$WT"   "git $PUSH -u origin feature/one"
allow "$WT"   "git $PUSH origin HEAD"
allow "$WT"   "timeout 60 git $PUSH origin feature/one"
allow "$MAIN" "git status && git log --oneline -3"
allow "$MAIN" "ls -la"
allow "$MAIN" "grep -rn \"git $PUSH origin main\" docs"
allow "$MAIN" "echo \"git $COMMIT on main\""
allow "$WT"   "ALLOW_DANGEROUS_GIT=1 git $RESET --hard"
allow "$MAIN" "ALLOW_DANGEROUS_GIT=1 git $COMMIT -m x"
allow "$WT"   "git branch -d feature/two"
allow "$WT"   "gh pr merge 1 --squash"
allow "$WT"   "npm test 2>&1 | tail -3 && git $COMMIT -m x"

# --- Guard: commits/pushes that may land on main are blocked ------------------
block "$MAIN" "git $COMMIT -m x"
block "$MAIN" "git $PUSH origin main"
block "$WT"   "git -C $MAIN $COMMIT -m x"
block "$MAIN" "git -C $WT status; git $COMMIT -m x"
block "$MAIN" "git -C $WT log --oneline | head; git $PUSH"
block "$MAIN" "ls $WT && git -C $WT diff; git $PUSH origin feature/one"
block "$MAIN" "git -C $NONGIT log; git $COMMIT -m x"
block "$WT"   "git -C $WT status; git -C $MAIN $COMMIT -m x"
block "$WT"   "cd $MAIN && git -C $WT status && git $COMMIT -m x"
block "$WT"   "cd $WT && cd $MAIN && git $COMMIT -m x"
block "$MAIN" "cd $WT && cd $MAIN && git $COMMIT -m x"
block "$WT"   "cd $NONGIT && cd $MAIN && git $COMMIT -m x"
block "$WT"   "(cd $MAIN && git $COMMIT -m x)"
block "$WT"   "true && cd $MAIN && git $COMMIT -m x"
block "$WT"   "cd $MAIN || exit 1; git $COMMIT -m x"
block "$WT"   "cd $MAIN
git $COMMIT -m x"
block "$MAIN" "cd $WT; git $COMMIT -m x"
block "$WT"   "cd \"\$CLAUDE_PROJECT_DIR\" && git $COMMIT -m x"
block "$WT"   "cd - && git $COMMIT -m x"
block "$WT"   "pushd $MAIN && git $COMMIT -m x"
block "$WT"   "bash -c 'cd $MAIN && git $COMMIT -m x'"
block "$WT"   "eval \"cd $MAIN && git $COMMIT -m x\""
block "$WT"   "echo \$(cd $MAIN && git $COMMIT -m x)"
block "$WT"   "watch \"git -C $MAIN $COMMIT -m x\""
block "$WT"   "GIT_DIR=$MAIN/.git git $COMMIT -m x"
block "$WT"   "git --git-dir=$MAIN/.git --work-tree=$MAIN $COMMIT -m x"
block "$WT"   "git -C \"\$HOME/elsewhere\" $COMMIT -m x"
block "$WT"   "git -C /does/not/exist $COMMIT -m x"
block "$MAIN" "git -c user.name=x $COMMIT -m x"
block "$MAIN" "git --no-pager $COMMIT -m x"
block "$MAIN" "git -C $MAIN -c user.name=x $COMMIT -m x"
block "$WT"   "git $PUSH origin HEAD:main"
block "$WT"   "git $PUSH origin main"
block "$WT"   "git $PUSH --force origin +refs/heads/feature/one:refs/heads/main"
block "$WT"   "git $PUSH origin --delete master"
block "$WT"   "git $PUSH --all origin"
block "$WT"   "git $PUSH origin \"\$BRANCH\""
block "$WT"   "timeout 60 git $PUSH origin main"
expect "block: missing cwd falls back to the hook's cwd (main)" 2 $G '{"tool_input":{"command":"git '"$COMMIT"' -m x"}}'

# Compound commands run their bodies in the current shell, so a cd persists.
block "$WT"   "{ cd $MAIN && git $COMMIT -m x; }"
block "$WT"   "if true; then cd $MAIN && git $COMMIT -m x; fi"
block "$WT"   "if cd $MAIN; then git $COMMIT -m x; fi"
block "$WT"   "for d in $MAIN; do cd \$d && git $COMMIT -m x; done"
block "$WT"   "while true; do cd $MAIN && git $COMMIT -m x; break; done"
block "$WT"   "until false; do cd $MAIN; git $COMMIT -m x; done"
block "$WT"   "time cd $MAIN && git $COMMIT -m x"
block "$WT"   "! cd $MAIN || git $COMMIT -m x"
block "$WT"   "f() { cd $MAIN && git $COMMIT -m x; }; f"
block "$WT"   "{ git $RESET --hard; }"
allow "$WT"   "if [ -f README.md ]; then git $COMMIT -m x; fi"
allow "$WT"   "for f in a b; do echo \$f; done && git $COMMIT -m x"
allow "$WT"   "( ( cd $MAIN ) && git $COMMIT -m x )"

# Oversized commands are not parsed: git commit/push in them fails closed, and
# the parse stays fast on the hot path.
BLOB=$(head -c 150000 /dev/zero | tr '\0' 'a')
allow "$WT"   "echo $BLOB; ls"
block "$WT"   "echo $BLOB; git $COMMIT -m x"
block "$WT"   "echo $BLOB; git $RESET --hard"
allow "$WT"   "ALLOW_DANGEROUS_GIT=1 git $COMMIT -m \"$BLOB\""
SUBS=""
for _ in $(seq 1000); do SUBS="$SUBS \$(cd x)"; done
START=$(date +%s)
allow "$WT"   "echo $SUBS"
allow "$WT"   "echo $(head -c 60000 /dev/zero | tr '\0' 'b') && git $COMMIT -m x"
expect_true "large and substitution-heavy commands are analysed quickly" "[ \$((\$(date +%s) - $START)) -le 5 ]"

# --- Guard: always-dangerous operations ----------------------------------------
block "$WT"   "git $RESET --hard"
block "$WT"   "git -C $WT $RESET --hard HEAD~1"
block "$WT"   "git branch -D feature/two"
block "$WT"   "git -C $WT branch -D feature/two"
block "$WT"   "git branch --delete --force feature/two"
block "$WT"   "git branch -d -f feature/two"
block "$WT"   "gh pr merge 1 --squash --delete-branch"
block "$WT"   "gh pr merge 1 -s -d"
block "$WT"   "echo ALLOW_DANGEROUS_GIT=1; git $RESET --hard"
block "$WT"   "ALLOW_DANGEROUS_GIT=1 git status && git $RESET --hard"

# --- Recorder + gate ------------------------------------------------------------
V=verify-gate.sh
OK=',"tool_response":{"stdout":"12 passing","stderr":"","interrupted":false}'
BAD=',"tool_response":{"stdout":"10 passing\n  2 failing","stderr":"","interrupted":false}'
TSC_BAD=',"tool_response":{"stdout":"Found 3 errors in 2 files.","stderr":"","interrupted":false}'
EXIT1=',"tool_response":{"stdout":"12 passing","exit_code":1}'
gate() { expect "$1" "$2" $V "$(payload "$3" '')"; }

gate "gate is inactive on main" 0 "$MAIN"
gate "gate is inactive outside a git repo" 0 "$NONGIT"
gate "gate blocks unverified worktree changes" 2 "$WT"

record "$(payload "$MAIN" "cd $WT && npm run typecheck && npm test" "$BAD")"
gate "failing test output records nothing" 2 "$WT"
record "$(payload "$WT" "npm run typecheck && npm test" "$TSC_BAD")"
gate "tsc 'Found N errors' records nothing" 2 "$WT"
record "$(payload "$WT" "npm run typecheck && npm test" "$EXIT1")"
gate "non-zero exit_code records nothing" 2 "$WT"
record "$(payload "$WT" "echo \"npm run typecheck && npm test\"" "$OK")"
gate "echo of the commands records nothing" 2 "$WT"
record "$(payload "$WT" "grep -rn \"npm run typecheck\\|npm test\" README.md" "$OK")"
gate "grep for the commands records nothing" 2 "$WT"
record "$(payload "$WT" "npm run typecheck || true; npm test" "$OK")"
gate "'typecheck || true; test' credits only test" 2 "$WT"
record "$(payload "$WT" "npm run typecheck 2>&1 | tail -1; npm test 2>&1 | tail -3" "$OK")"
gate "piped checks are not credited" 2 "$WT"

echo "export const b = 21;" >"$WT/imports/b.ts"   # fresh code state: drop the credited test
record "$(payload "$MAIN" "cd $WT && npm run typecheck" "$OK")"
gate "typecheck alone does not satisfy the gate" 2 "$WT"
record "$(payload "$MAIN" "cd $WT && npm run typecheck && npm test" "$OK")"
gate "combined command records both checks" 0 "$WT"
expect_true "state is stored in the worktree" "[ -f '$WT/.claude/.verify-state' ]"
expect_true "no state is written to the primary checkout" "[ ! -f '$MAIN/.claude/.verify-state' ]"

record "$(payload "$WT2" "npm run typecheck && npm test" "$OK")"
gate "a parallel worktree does not clobber the record" 0 "$WT"
gate "the parallel worktree has its own record" 0 "$WT2"

echo "export const b = 22;" >"$WT/imports/b.ts"
gate "an edit re-arms the gate" 2 "$WT"
record "$(payload "$WT" "npm run typecheck" "$OK")"
record "$(payload "$WT" "meteor test --once --driver-package meteortesting:mocha --port 3500" "$OK")"
gate "separate typecheck + test runs satisfy the gate" 0 "$WT"

echo "export const c = 33;" >"$WT2/imports/c.ts"
record "$(payload "$WT" "npm run typecheck && npm test && git -C $WT2 status" "$OK")"
gate "a trailing git -C does not credit another worktree" 2 "$WT2"

record "$(payload "$WT2/imports" "npm run typecheck && npm test" "$OK")"
gate "a subdirectory session records for the whole tree" 0 "$WT2"
echo "export const z = 1;" >"$WT2/client/z.ts"
gate "untracked files outside the session subdirectory re-arm the gate" 2 "$WT2/imports"

git init -q "$WT2/nested-repo"   # listed by `git ls-files --others` as `nested-repo/`
record "$(payload "$WT2" "npm run typecheck && npm test" "$OK")"
gate "an untracked nested repository does not blank the signature" 0 "$WT2"

record "$(payload "$NONGIT" "npm run typecheck && npm test" "$OK")"
expect_true "no state is recorded outside a git repo" "[ ! -e '$NONGIT/.claude' ] && [ ! -f '$MAIN/.claude/.verify-state' ]"

expect "stop_hook_active short-circuits the gate" 0 $V '{"cwd":"'"$WT2"'","stop_hook_active":true}'

echo
echo "hooks: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
