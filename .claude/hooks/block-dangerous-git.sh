#!/usr/bin/env bash
#
# PreToolUse(Bash) guard — blocks repo-specific dangerous git/gh operations.
#
# Branch-aware, so the normal branch -> commit -> push -> PR workflow (including
# commits in git worktrees) stays unblocked. Only the documented footguns are
# denied:
#   - git commit / git push that may run in a working tree on the default branch
#     (main/master). Every directory the command could run in counts — the
#     session cwd, `cd`/`pushd` targets, `git -C`, `--git-dir`/`GIT_DIR` — and a
#     directory that cannot be determined (shell expansion, `cd -`) fails closed
#   - git push whose destination is main/master (`origin main`, `HEAD:main`,
#     `--all`, `--mirror`), from any branch
#   - git reset --hard            (irreversible working-tree/index loss)
#   - git branch -D / --delete --force  (lose unmerged commits)
#   - gh pr merge --delete-branch (auto-closes open child PRs — stacked-PR footgun)
# git global options (-C, -c, --git-dir, --no-pager, ...) are understood for all
# rules. The command is parsed shell-aware by analyze-command.awk: quoting,
# `&&`/`||`/`;`/`|` chains, subshells, `bash -c`/`eval`, `$(…)` and heredocs.
#
# Escape hatch: prefix the offending command with ALLOW_DANGEROUS_GIT=1, e.g.
#   ALLOW_DANGEROUS_GIT=1 git reset --hard origin/main
# It applies to that one command only, not to others chained with it.
#
# Contract: exit 0 = allow, exit 2 = block (stderr shown to the agent).

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

INPUT=$(cat)
[ -z "$INPUT" ] && exit 0

deny() {
  echo "BLOCKED by .claude/hooks/block-dangerous-git.sh: $1" >&2
  echo "If this is genuinely intended, prefix that command with ALLOW_DANGEROUS_GIT=1" >&2
  exit 2
}

ANALYSIS=$(analyze_payload "$INPUT")

while IFS=$'\t' read -r kind value; do
  case "$kind" in
    DENY)
      case "$value" in
        reset-hard) deny "'git reset --hard' irreversibly discards working-tree and index changes." ;;
        branch-force-delete) deny "'git branch -D' force-deletes a branch and can drop unmerged commits. Use -d (safe delete) instead." ;;
        gh-merge-delete) deny "'gh pr merge --delete-branch' auto-closes open child PRs (stacked-PR footgun). Merge first, delete the branch later once no child PR depends on it." ;;
      esac
      ;;
    LARGE)
      deny "the command is too large to analyse safely (over 64 KB) and contains git commit/push. Run the git command separately (e.g. write a long message to a file and use git commit -F <file>)."
      ;;
    PUSHMAIN)
      deny "'git push $value' pushes to the default branch. Push a feature branch and open a PR (CLAUDE.md workflow)."
      ;;
    PUSHUNRESOLVED)
      deny "cannot verify the destination of 'git push … $value' (shell expansion). Use a literal branch name."
      ;;
    TARGET)
      DIR=$(resolve_dir "$value") ||
        deny "cannot determine the working tree a git commit/push runs in ('$value'). Use a literal path, e.g. git -C <worktree> commit."
      BRANCH=$(git -C "$DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
      if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
        deny "Refusing a git commit/push in '$DIR', which is on '$BRANCH'. Create a feature branch first (CLAUDE.md workflow: issue -> branch -> implement -> PR)."
      fi
      ;;
    GITDIR)
      [ "$value" = "?" ] && deny "cannot determine the --git-dir/GIT_DIR of a git commit/push. Use a literal path."
      BRANCH=$(git --git-dir="$value" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
      if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
        deny "Refusing a git commit/push with git dir '$value', which is on '$BRANCH'. Create a feature branch first."
      fi
      ;;
  esac
done <<<"$ANALYSIS"

exit 0
