# Claude Code hooks

Harness-level guardrails that convert prose rules from `CLAUDE.md` / agent memory
into checks the harness enforces, so they cannot be silently skipped. Wired up in
[`.claude/settings.json`](../settings.json). All scripts are referenced via
`$CLAUDE_PROJECT_DIR` and are **worktree-aware**: they reason about the directories a
command actually runs in, never about the hook process's own directory (the primary
checkout, usually on `main`).

| Hook | Event | Script | What it does |
|------|-------|--------|--------------|
| Dangerous-git guard | `PreToolUse(Bash)` | `block-dangerous-git.sh` | Blocks repo-specific git/gh footguns before they run |
| Verification recorder | `PostToolUse(Bash)` | `record-verify.sh` | Records when `typecheck`/`test` pass for the current code state |
| Verification gate | `Stop` | `verify-gate.sh` | Refuses to end a turn with unverified source changes |

Shared pieces: `lib.sh` (directory resolution, tree signature) and
`analyze-command.awk`, a POSIX-awk, shell-aware parser of the Bash command. It
understands quoting, `&&` / `||` / `;` / `|` / newline chains, `( … )` subshells,
`bash -c` / `eval` bodies, `$( … )` / backtick substitutions and heredocs, and tracks
which directories each command may run in: the session `cwd`, then `cd`/`pushd`
targets (a `cd` followed by `&&` moves there; after `;`, `||`, `|` or a newline the cd
may have failed, so both directories stay possible). `( … )` and `bash -c` bodies are
scoped; `{ …; }`, `if`/`for`/`while` bodies and functions share the current shell.

Commands over 64 KB are not parsed (the hooks run on every Bash call and must stay
fast): a git commit/push in such a command is denied, and nothing is recorded.

## Dangerous-git guard (`block-dangerous-git.sh`)

Branch-aware — the normal `branch → commit → push → PR` flow is **not** blocked,
including commits in feature worktrees. Only these are denied (exit 2):

- `git commit` / `git push` when **any** directory it may run in is on the default
  branch (`main`/`master`): the session cwd, `cd`/`pushd` targets, `git -C`,
  `--git-dir` / `GIT_DIR`. A directory that cannot be determined (shell expansion
  such as `cd "$DIR"`, `cd -`, a path that does not exist) is denied too — fail
  closed. Use literal paths: `git -C <worktree> commit` or `cd <worktree> && git commit`
- `git push` whose destination is `main`/`master` (`origin main`, `HEAD:main`,
  `refs/heads/main`, `--delete main`, `--all`, `--mirror`), from any branch, or whose
  destination involves shell expansion
- `git reset --hard` (irreversible working-tree/index loss)
- `git branch -D` / `--delete --force` (can drop unmerged commits)
- `gh pr merge --delete-branch` (auto-closes open child PRs — the stacked-PR footgun)

git global options (`-C`, `-c`, `--git-dir`, `--no-pager`, …) and wrappers
(`timeout 60 git …`) are understood for every rule.

**Escape hatch:** prefix the offending command with `ALLOW_DANGEROUS_GIT=1`. It applies
to that command only, not to other commands chained with it:

```bash
ALLOW_DANGEROUS_GIT=1 git reset --hard origin/main
```

Limits: git invoked indirectly by a script or tool (`./release.sh`, `make`) and git
aliases are not visible to the guard.

## Verification gate (`verify-gate.sh` + `record-verify.sh`)

Prevents an agent from declaring "done" when the branch has **source** changes
(`imports/`, `server/`, `client/`, `tests/`, `e2e/`, or a root `*.ts`) that have
not passed `npm run typecheck` **and** `npm test` for the current code state.

How it works:

1. `record-verify.sh` (PostToolUse) watches Bash commands and records passing checks
   against a **tree signature** (`HEAD` sha + hashes of the tracked diff and untracked
   files, always computed from the working tree's top level) in
   `<worktree>/.claude/.verify-state` (gitignored) — one record per working tree, so
   parallel worktree sessions never overwrite each other. It is conservative:
   - only a verification command in **command position** counts (`npm run typecheck`,
     `tsc --noEmit`, `npm test`, `meteor test`), not the same text inside
     `echo`/`grep` arguments
   - a check is credited only when its exit status decides the whole command's
     status — nothing but `&&` may follow it and it is not piped onward
     (`npm run typecheck || true; npm test` credits only `test`)
   - it is credited to the single working tree it runs in (leading `cd … &&` or the
     session cwd); an ambiguous directory records nothing
   - an explicit non-zero `exit_code`, `interrupted: true`, or a failure signal in the
     output (`error TS…`, `Found N errors`, `N failing`, `FAIL `, `npm error`, …)
     records nothing
2. Any edit changes the tree signature, which re-arms the gate.
3. `verify-gate.sh` (Stop) blocks the turn until both checks are recorded for the
   current signature of the session cwd's working tree. It is inactive outside a git
   working tree, on the default branch, and when no source files changed. Work done
   in another worktree via `cd <other> && …` is not gated.

**Satisfy it** by running `npm run typecheck && npm test` (recorded automatically).
**Bypass it** with `CLAUDE_SKIP_VERIFY_GATE=1` (not recommended).

## Testing the hooks

Run the self-contained suite (builds a throwaway repo with feature worktrees and
replays guard, recorder and gate scenarios):

```bash
.claude/hooks/test-hooks.sh
HOOKS_DIR=/path/to/other/hooks .claude/hooks/test-hooks.sh   # test another copy
```

Each script reads a JSON event on stdin and signals via exit code (0 allow, 2 block):

```bash
# should BLOCK (exit 2)
echo '{"tool_input":{"command":"git reset --hard"}}' | .claude/hooks/block-dangerous-git.sh
# should ALLOW (exit 0)
echo '{"tool_input":{"command":"ALLOW_DANGEROUS_GIT=1 git reset --hard"}}' | .claude/hooks/block-dangerous-git.sh
```
