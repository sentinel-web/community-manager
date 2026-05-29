#!/usr/bin/env bash
#
# Shared helpers for the verification-gate hooks. Sourced by record-verify.sh
# (PostToolUse) and verify-gate.sh (Stop) so the signature definition can never
# drift between the recorder and the gate.

# tree_sig — a CONTENT-sensitive signature of the current code state.
# Combines HEAD, the full tracked diff vs HEAD (staged + unstaged content), and
# the contents of untracked files. Any edit — including to an already-dirty or
# untracked file — changes the signature and re-arms the gate. Using only
# `git status --porcelain` would miss content edits (the status line is
# identical regardless of how the file changed).
tree_sig() {
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
}
