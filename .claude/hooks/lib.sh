#!/usr/bin/env bash
#
# Shared helpers for the hooks. Sourced by block-dangerous-git.sh (PreToolUse),
# record-verify.sh (PostToolUse) and verify-gate.sh (Stop) so the signature and
# target-directory definitions can never drift between them.
#
# Payloads are matched as raw JSON with grep/sed (no jq/node dependency — a
# guard that silently fails when its parser is missing is worse than no guard).
# Inside JSON strings every `"` is escaped as `\"`, so a pattern starting with an
# unescaped `"key"` only ever matches a real top-level key, never command text.

# payload_cwd <payload> — the session working directory Claude Code reports in
# the hook payload (`cwd`), or empty when absent.
payload_cwd() {
  printf '%s' "$1" | grep -oE '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/^"cwd"[[:space:]]*:[[:space:]]*"//; s/"$//'
}

# payload_command <payload> — the raw (still JSON-escaped) Bash command, or empty.
payload_command() {
  printf '%s' "$1" | grep -oE '"command"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"' | head -1 | sed -E 's/^"command"[[:space:]]*:[[:space:]]*"//; s/"$//'
}

# strip_quotes <word> — removes one layer of surrounding single, double or
# JSON-escaped double quotes.
strip_quotes() {
  local w="$1"
  w="${w#\\\"}"; w="${w%\\\"}"
  w="${w#\"}"; w="${w%\"}"
  w="${w#\'}"; w="${w%\'}"
  printf '%s' "$w"
}

# A shell word as it appears inside the JSON-escaped command: \"quoted\",
# 'quoted', or a bare run without whitespace/quotes/separators.
WORD_RE='(\\"([^"\\]|\\[^"])*\\"|'"'"'[^'"'"']*'"'"'|[^[:space:]"'"'"';&|]+)'

# target_dir <payload> — the directory a command operates in, so git state is
# read from the worktree the command targets rather than from the hook process's
# own directory (the primary checkout). Resolution order:
#   1. `git -C <path>` in the command
#   2. a leading `cd <path> &&` / `cd <path>;`
#   3. the payload's `cwd`
#   4. $PWD
# Relative paths resolve against the payload cwd. A path that does not exist
# falls through to the next rule.
target_dir() {
  local payload="$1" cmd base candidate
  cmd=$(payload_command "$payload")
  base=$(payload_cwd "$payload")
  [ -n "$base" ] && [ -d "$base" ] || base="$PWD"

  candidate=$(printf '%s' "$cmd" | grep -oE "git[[:space:]]+-C[[:space:]]+$WORD_RE" | head -1 | sed -E 's/^git[[:space:]]+-C[[:space:]]+//')
  if [ -z "$candidate" ]; then
    candidate=$(printf '%s' "$cmd" | grep -oE "^[[:space:]]*cd[[:space:]]+$WORD_RE[[:space:]]*(&&|;)" | head -1 | sed -E 's/^[[:space:]]*cd[[:space:]]+//; s/[[:space:]]*(&&|;)$//')
  fi
  if [ -n "$candidate" ]; then
    candidate=$(strip_quotes "$candidate")
    case "$candidate" in
      /*) ;;
      "~"|"~/"*) candidate="$HOME${candidate#\~}" ;;
      *) candidate="$base/$candidate" ;;
    esac
    if [ -d "$candidate" ]; then
      printf '%s' "$candidate"
      return
    fi
  fi
  printf '%s' "$base"
}

# state_file <dir> — per-working-tree verification record. Each worktree gets
# its own file so parallel sessions never overwrite each other's results.
# (`.claude/.verify-state` is gitignored.)
state_file() {
  local top
  top=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-$1}")
  printf '%s/.claude/.verify-state' "$top"
}

# tree_sig [dir] — a CONTENT-sensitive signature of the code state in `dir`
# (default: current directory). Combines HEAD, the full tracked diff vs HEAD
# (staged + unstaged content), and the contents of untracked files. Any edit —
# including to an already-dirty or untracked file — changes the signature and
# re-arms the gate. Using only `git status --porcelain` would miss content edits
# (the status line is identical regardless of how the file changed).
tree_sig() {
  (
    cd "${1:-.}" 2>/dev/null || exit 0
    local head diff others_list others
    head=$(git rev-parse HEAD 2>/dev/null || echo none)
    diff=$(git diff HEAD 2>/dev/null | sha1sum | cut -d' ' -f1)
    others_list=$(git ls-files --others --exclude-standard 2>/dev/null || true)
    if [ -n "$others_list" ]; then
      others=$(printf '%s\n' "$others_list" | while IFS= read -r f; do cat "$f" 2>/dev/null; done | sha1sum | cut -d' ' -f1)
    else
      others=$(printf '' | sha1sum | cut -d' ' -f1)
    fi
    printf '%s:%s:%s' "$head" "$diff" "$others"
  )
}
