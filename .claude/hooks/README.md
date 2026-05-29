# Claude Code hooks

Harness-level guardrails that convert prose rules from `CLAUDE.md` / agent memory
into checks the harness enforces, so they cannot be silently skipped. Wired up in
[`.claude/settings.json`](../settings.json). All scripts are referenced via
`$CLAUDE_PROJECT_DIR` so they also work inside git worktrees.

| Hook | Event | Script | What it does |
|------|-------|--------|--------------|
| Dangerous-git guard | `PreToolUse(Bash)` | `block-dangerous-git.sh` | Blocks repo-specific git/gh footguns before they run |
| Verification recorder | `PostToolUse(Bash)` | `record-verify.sh` | Records when `typecheck`/`test` pass for the current code state |
| Verification gate | `Stop` | `verify-gate.sh` | Refuses to end a turn with unverified source changes |

## Dangerous-git guard (`block-dangerous-git.sh`)

Branch-aware — the normal `branch → commit → push → PR` flow is **not** blocked.
Only these are denied (exit 2):

- `git commit` / `git push` while on the default branch (`main`/`master`)
- `git reset --hard` (irreversible working-tree/index loss)
- `git branch -D` / `--delete --force` (can drop unmerged commits)
- `gh pr merge --delete-branch` (auto-closes open child PRs — the stacked-PR footgun)

**Escape hatch:** prefix any one command with `ALLOW_DANGEROUS_GIT=1`, e.g.

```bash
ALLOW_DANGEROUS_GIT=1 git reset --hard origin/main
```

## Verification gate (`verify-gate.sh` + `record-verify.sh`)

Prevents an agent from declaring "done" when the branch has **source** changes
(`imports/`, `server/`, `client/`, `tests/`, `e2e/`, or a root `*.ts`) that have
not passed `npm run typecheck` **and** `npm test` for the current code state.

How it works:

1. `record-verify.sh` (PostToolUse) watches Bash commands. When a typecheck or
   test command passes, it records that against a **tree signature**
   (`HEAD` sha + dirty-tree hash) in `.claude/.verify-state` (gitignored). It is
   conservative — it records a pass only on an explicit `exit_code == 0` or, as a
   fallback, when no failure tokens appear in the output — so the gate can never
   be *falsely* satisfied.
2. Any edit changes the tree signature, which re-arms the gate.
3. `verify-gate.sh` (Stop) blocks the turn until both checks are recorded for the
   current signature. It is inactive on the default branch and when no source
   files changed.

**Satisfy it** by running `npm run typecheck && npm test` (recorded automatically).
**Bypass it** with `CLAUDE_SKIP_VERIFY_GATE=1` (not recommended).

## Testing the hooks

Each script reads a JSON event on stdin and signals via exit code (0 allow, 2 block):

```bash
# should BLOCK (exit 2)
echo '{"tool_input":{"command":"git reset --hard"}}' | .claude/hooks/block-dangerous-git.sh
# should ALLOW (exit 0)
echo '{"tool_input":{"command":"ALLOW_DANGEROUS_GIT=1 git reset --hard"}}' | .claude/hooks/block-dangerous-git.sh
```
