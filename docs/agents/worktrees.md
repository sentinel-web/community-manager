# Worktree isolation for parallel / autonomous work

Claude Code sessions share one git working directory. When two run concurrently —
or an AFK/autonomous run is interrupted and resumed — they can collide: commits
land on the wrong branch, or one session's checkout switch strands another's work
(`feedback_shared_workdir_branch_collision`). This guide is the project's defence.

## TL;DR

- One feature task at a time. **Autonomous runs default to serial feature execution.**
- For anything that may run alongside another session, work in an **isolated worktree**:
  ```bash
  scripts/new-worktree.sh feature/issue-123-thing   # then cd into the printed path
  ```
- `/commit` and `/pr` run `scripts/check-branch.sh <issue#>` first and refuse to act on
  the wrong branch (or on `main`).

## Why worktrees, not branch switching

`git checkout` mutates the single shared working tree, so a second session sees the
first's files and branch. A `git worktree` is a separate directory bound to the same
repository with its **own** checked-out branch — two sessions never tread on each other.

Worktrees live under `.claude/worktrees/<branch-leaf>/`.

## What is shared, and what is not

`scripts/new-worktree.sh`:

- **Shares `node_modules`** with the primary checkout via a symlink. Dependencies are
  large and effectively read-only, so this skips a multi-minute reinstall per worktree.
- **Does NOT share `.meteor/local`.** That is a *stateful* build cache, and a shared one
  desyncs concurrent Meteor processes — the same failure documented in
  `reference_meteor_test_collides_with_dev_server` (a `meteor test` colliding with a
  running dev server through one `.meteor/local`). Each worktree gets its own, rebuilt on
  first boot. Correctness (Security > Performance) wins over saving the first-boot time.

## Lifecycle

```bash
# create (off main by default; pass a base ref as the 2nd arg)
scripts/new-worktree.sh feature/issue-123-thing
cd .claude/worktrees/issue-123-thing

# ...implement, commit (check-branch.sh runs via /commit), push, open PR...

# after the PR is merged, remove the worktree
git worktree remove .claude/worktrees/issue-123-thing
```

Do not delete the branch with `gh pr merge --delete-branch` while a stacked child PR is
open (`feedback_stacked_pr_merge`); merge first, delete later.

## The branch guard

`scripts/check-branch.sh <expected>` exits non-zero unless the current branch matches:

- an exact branch name, or
- a bare issue number that the current branch references (`feature/issue-<N>-…`).

It also hard-fails on `main`/`master`, so a task can never commit to the default branch.
This is the "commits land on the intended branch" check called for by issue #279.

## When parallel is and isn't appropriate

- **Good for parallel:** read-only work (code review, research, audits) and genuinely
  independent features that touch disjoint files.
- **Keep serial:** the normal autonomous feature loop. Interleaving feature edits across
  sessions is where the wrong-branch-commit and merge-conflict pain comes from.
