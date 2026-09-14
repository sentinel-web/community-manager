#!/usr/bin/env bash
#
# Shared helpers for the hooks. Sourced by block-dangerous-git.sh (PreToolUse),
# record-verify.sh (PostToolUse) and verify-gate.sh (Stop) so the command parse,
# directory resolution and tree signature can never drift between them.
#
# The Bash command is parsed by analyze-command.awk (POSIX awk, no jq/node
# dependency — a guard that silently fails when its parser is missing is worse
# than no guard). See that file for the record format.

HOOKS_LIB_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# analyze_payload <payload> — the analysis records for a hook payload.
analyze_payload() {
  printf '%s' "$1" | awk -v home="${HOME:-}" -v fallback_cwd="$PWD" -f "$HOOKS_LIB_DIR/analyze-command.awk"
}

# resolve_dir <path> — the physical absolute directory, or failure when the path
# is "?" (undeterminable) or does not exist.
resolve_dir() {
  [ "$1" = "?" ] && return 1
  (cd "$1" 2>/dev/null && pwd -P)
}

# repo_top <dir> — the working tree's top-level directory, or failure when `dir`
# is not inside a git working tree.
repo_top() {
  git -C "$1" rev-parse --show-toplevel 2>/dev/null
}

# state_file <toplevel> — per-working-tree verification record, so parallel
# worktree sessions never overwrite each other's results (gitignored).
state_file() {
  printf '%s/.claude/.verify-state' "$1"
}

# tree_sig <toplevel> — a CONTENT-sensitive signature of the working tree's code
# state: HEAD, the full tracked diff vs HEAD (staged + unstaged) and the names and
# contents of untracked files. Any edit re-arms the gate. Always computed from
# the top level so a session in a subdirectory still covers the whole tree.
# Hashes with `git hash-object` (sha1sum is missing on stock macOS). Prints
# nothing on failure; callers treat an empty signature as "not verified".
tree_sig() {
  (
    cd "$1" 2>/dev/null || exit 1
    head=$(git rev-parse HEAD 2>/dev/null || echo none)
    diff=$(git diff HEAD 2>/dev/null | git hash-object --stdin) || exit 1
    others=$(git ls-files --others --exclude-standard 2>/dev/null |
      while IFS= read -r f; do printf '%s\n' "$f"; cat "$f" 2>/dev/null; done | git hash-object --stdin) || exit 1
    printf '%s:%s:%s' "$head" "$diff" "$others"
  )
}
