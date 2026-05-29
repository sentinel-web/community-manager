#!/usr/bin/env bash
#
# PreToolUse(Bash) guard — blocks repo-specific dangerous git/gh operations.
#
# Unlike a blanket "git push" block, this is branch-aware: the normal
# branch -> commit -> push -> PR workflow stays unblocked. Only the documented
# footguns are denied:
#   - git commit / git push while on the default branch (main/master)
#   - git reset --hard            (irreversible working-tree/index loss)
#   - git branch -D / --delete --force  (lose unmerged commits)
#   - gh pr merge --delete-branch (auto-closes open child PRs — stacked-PR footgun)
#
# Escape hatch: prefix any single command with ALLOW_DANGEROUS_GIT=1 to bypass,
# e.g.  ALLOW_DANGEROUS_GIT=1 git reset --hard origin/main
#
# The hook reads the tool-call JSON on stdin. The Bash command lives in
# .tool_input.command; every pattern below is plain ASCII that survives JSON
# string-escaping unchanged, so we match the raw payload directly and avoid a
# dependency on jq/node (a guard that silently fails when its parser is missing
# is worse than no guard).
#
# Contract: exit 0 = allow, exit 2 = block (stderr shown to the agent).

set -uo pipefail

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

# Per-command escape hatch.
if printf '%s' "$INPUT" | grep -q 'ALLOW_DANGEROUS_GIT=1'; then
  exit 0
fi

deny() {
  echo "BLOCKED by .claude/hooks/block-dangerous-git.sh: $1" >&2
  echo "If this is genuinely intended, re-run the command prefixed with ALLOW_DANGEROUS_GIT=1" >&2
  exit 2
}

# --- Always-dangerous, irreversible operations -------------------------------

if printf '%s' "$INPUT" | grep -qE 'git[[:space:]]+reset[[:space:]]+(--[[:alnum:]-]+[[:space:]]+)*--hard'; then
  deny "'git reset --hard' irreversibly discards working-tree and index changes."
fi

if printf '%s' "$INPUT" | grep -qE 'git[[:space:]]+branch[[:space:]]+([^|&;\\]*[[:space:]])?(-D|--delete[[:space:]]+--force|--force[[:space:]]+--delete)'; then
  deny "'git branch -D' force-deletes a branch and can drop unmerged commits. Use -d (safe delete) instead."
fi

# Stacked-PR footgun: deleting the source branch on merge auto-closes any child PR.
if printf '%s' "$INPUT" | grep -qE 'gh[[:space:]]+pr[[:space:]]+merge' \
   && printf '%s' "$INPUT" | grep -qE '(--delete-branch|[[:space:]]-d([[:space:]]|\\|"))'; then
  deny "'gh pr merge --delete-branch' auto-closes open child PRs (stacked-PR footgun). Merge first, delete the branch later once no child PR depends on it."
fi

# --- Commits / pushes on the default branch ----------------------------------

if printf '%s' "$INPUT" | grep -qE 'git[[:space:]]+(commit|push)([[:space:]]|\\|")'; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    deny "Refusing a git commit/push while on '$BRANCH'. Create a feature branch first (CLAUDE.md workflow: issue -> branch -> implement -> PR)."
  fi
fi

exit 0
