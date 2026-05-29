#!/usr/bin/env bash
#
# Create an isolated git worktree for a task, so parallel/autonomous agent
# sessions don't collide on the shared primary checkout (commits landing on the
# wrong branch — see feedback_shared_workdir_branch_collision / docs/agents/worktrees.md).
#
# node_modules (large, effectively read-only) is shared from the primary checkout
# via a symlink so we don't pay a fresh install per worktree. .meteor/local is
# DELIBERATELY NOT shared: it is a stateful build cache, and a shared one desyncs
# concurrent Meteor processes (reference_meteor_test_collides_with_dev_server).
# Each worktree therefore gets its own .meteor/local, rebuilt on first boot.
#
# Usage: scripts/new-worktree.sh <branch-name> [base-ref]
#   scripts/new-worktree.sh feature/issue-123-foo        # off main
#   scripts/new-worktree.sh fix/issue-9-bar origin/main

set -euo pipefail

BRANCH="${1:?usage: scripts/new-worktree.sh <branch-name> [base-ref]}"
BASE="${2:-main}"

ROOT=$(git rev-parse --show-toplevel)
LEAF=$(basename "$BRANCH")
WT="$ROOT/.claude/worktrees/$LEAF"

if [ -e "$WT" ]; then
  echo "Worktree already exists: $WT" >&2
  exit 1
fi

git -C "$ROOT" worktree add -b "$BRANCH" "$WT" "$BASE"

# Share node_modules (read-only deps) to skip a multi-minute reinstall.
if [ -d "$ROOT/node_modules" ] && [ ! -e "$WT/node_modules" ]; then
  ln -s "$ROOT/node_modules" "$WT/node_modules"
  echo "Linked node_modules -> primary checkout (shared)."
fi

echo
echo "Worktree ready: $WT"
echo "  branch '$BRANCH' off '$BASE', isolated from the primary checkout."
echo "  node_modules: shared    .meteor/local: own (built on first boot)"
echo
echo "Work in it with:"
echo "  cd \"$WT\""
echo
echo "When done, after the branch is merged, remove it with:"
echo "  git worktree remove \"$WT\""
