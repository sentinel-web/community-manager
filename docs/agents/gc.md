# GC / "dreaming" cadence

A recurring sweep that keeps the agent-development system from accreting forever.
`CLAUDE.md` and the `~/.claude/.../memory/` notes accumulate case-by-case rules
and demonstrably go stale (the `.js` scaffolders #277 fixed; the Node-22 pin
spread across six spots). The repo's memory need is **freshness and promotion**,
not more notes — so this cadence *promotes* recurring prose into mechanical
checks and *prunes* what no longer earns its place.

Pairs with the weekly routines in [`routines.md`](routines.md); deliver its
output via `scripts/post-digest.sh gc` (added in #280).

## The three moves

### 1. Every escaped regression grows the verifier

When a bug reaches `main`, the fix PR must **also add the mocha/e2e test that
would have caught it** — no fix-only PRs for escaped regressions. The test suite
then only ever gets stricter at the exact points where it was proven too loose.

### 2. Promote recurring notes into enforcement

If the same class of mistake shows up in `MEMORY.md` / `CLAUDE.md` more than
once, it should stop being prose and become an artifact that can't be skipped:

| Recurring note about… | Promote to |
|-----------------------|------------|
| a code convention (naming, banned API, required prop) | an ESLint rule (`eslint.config.mjs`, #276) |
| a git / verification footgun | a hook (`.claude/hooks/`, #275) |
| a behavioral invariant | a mocha assertion (`tests/`) |
| a doc/code-shape contract | a guard test (e.g. the scaffolder guard, #277) |

Annotate each `CLAUDE.md` guardrail / `MEMORY.md` note with the commit or issue
that motivated it, so a later sweep can tell whether it still reproduces.

### 3. Prune — the "dreaming" pass

A **non-destructive** memory consolidation, proposed as a diff for the
maintainer to accept (never auto-applied):

- Dedupe overlapping `reference_*` notes into one.
- Fact-check each note against current code; flag any that name a file/flag/
  function that no longer exists (verify before deleting — notes are
  point-in-time).
- Flag rules that no longer reproduce a failure on the current model for
  retirement, and rules that have been promoted to an artifact (move #2) so the
  prose can be replaced by a pointer.
- Re-collapse duplicated facts (e.g. a version pin repeated across files) toward
  a single source of truth.

## Cadence

Weekly (fold into the Monday docs-drift sitting in `routines.md`), or `/loop` it
locally before a release. Output is a **punch list + a proposed memory diff** —
the human accepts the promotions and prunes. It never edits `MEMORY.md`,
`CLAUDE.md`, or deletes a test on its own.

## Prompt to schedule

```
GC sweep for sentinel-web/community-manager:
1. List regressions that reached main since the last sweep; for each, name the
   mocha/e2e test that should have caught it (open a punch-list item if absent).
2. Scan CLAUDE.md + the agent memory notes for rules that recur or that now
   reproduce no failure; for each, propose promotion to an ESLint rule / hook /
   mocha assertion, or retirement.
3. Propose a non-destructive memory diff: dedupe overlapping reference_ notes,
   flag stale file/flag references (verify against current code first).
Do not edit memory, CLAUDE.md, or tests — punch list + proposed diff only.
Then pipe the digest to: scripts/post-digest.sh gc
```
