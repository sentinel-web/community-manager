# Merged-PR survival rate

An autonomous-quality signal that a green CI run hides: **did the merged code
survive?** CI pass-rate says a PR *merged clean*; survival rate says it *stayed*.
Code that's reverted or rewritten within a few days was accepted but not actually
right — the metric that catches confidently-wrong agent output.

Track it as an extra line in the pr-babysitter digest (see
[`routines.md`](routines.md)).

## Definition

For each PR merged in the trailing window (e.g. 14 days), classify it:

- **survived** — its merge commit is still substantially present; no later commit
  reverts it or rewrites the same lines.
- **reverted** — a later commit/PR reverts it (a `Revert "..."` commit, or a PR
  that undoes it).
- **rewritten** — ≥ ~50% of its added lines were changed again within the window
  by a *different* PR (not a follow-on by the same feature).

**Survival rate = survived / merged**, reported with the reverted/rewritten PRs
named so the pattern (which area, which kind of change) is visible.

## How to gather

```bash
# merged PRs in the window
gh pr list --repo sentinel-web/community-manager --state merged \
  --search "merged:>=$(date -d '14 days ago' +%F)" \
  --json number,title,mergeCommit,mergedAt,files

# reverts on main in the window
git log --since='14 days ago' origin/main --grep='^Revert' --oneline
```

For "rewritten", compare each merged PR's changed files against subsequent commits
touching the same paths (`git log -L` or a per-file churn count). Approximate is
fine — this is a trend signal, not an accounting figure.

## Reading it

- A high survival rate (≈ what a careful human achieves) means autonomous merges
  are trustworthy at the current settings.
- A dip, especially clustered in one area, is the cue to tighten that area's
  contract/tests or pull those changes back under closer review — *before* a
  reverted-PR streak erodes confidence in the whole loop.

The metric is **surfaced, not enforced** — same principle as the rest of the
pr-babysitter routine. Once #280 lands, deliver it via
`scripts/post-digest.sh pr-babysitter`.
