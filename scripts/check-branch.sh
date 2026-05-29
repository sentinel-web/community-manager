#!/usr/bin/env bash
#
# Guard run before commit / push / PR: confirm the working tree is on the branch
# the current task expects. In a shared checkout used by parallel/autonomous
# sessions, a task can drift onto the wrong branch and land commits there
# (feedback_shared_workdir_branch_collision). This makes that a hard stop.
#
# Usage: scripts/check-branch.sh <expected-branch | issue-number>
#   scripts/check-branch.sh feature/issue-123-foo
#   scripts/check-branch.sh 123        # current branch must reference issue 123

set -euo pipefail

EXPECTED="${1:?usage: scripts/check-branch.sh <expected-branch | issue-number>}"
CURRENT=$(git rev-parse --abbrev-ref HEAD)

# Exact branch match.
if [ "$CURRENT" = "$EXPECTED" ]; then
  exit 0
fi

# Bare issue number: the current branch must reference issue-<N> (feature/issue-N-...).
if printf '%s' "$EXPECTED" | grep -qE '^[0-9]+$' && printf '%s' "$CURRENT" | grep -qE "issue-${EXPECTED}(-|$)"; then
  exit 0
fi

# Never let an accidental commit land on the default branch either.
if [ "$CURRENT" = "main" ] || [ "$CURRENT" = "master" ]; then
  echo "BRANCH MISMATCH: on the default branch '$CURRENT' — never commit a task here." >&2
else
  echo "BRANCH MISMATCH: on '$CURRENT' but this task expects '$EXPECTED'." >&2
fi
echo "Switch to the right branch (or its worktree) before committing — see docs/agents/worktrees.md." >&2
exit 1
