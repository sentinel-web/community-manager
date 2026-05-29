# /commit

Create a commit with a clean, descriptive message.

## Usage
`/commit` - Stage and commit current changes
`/commit <message>` - Commit with provided message

## Instructions

1. **Verify branch context** — run `scripts/check-branch.sh <issue-number>` first. In a
   shared checkout used by parallel/autonomous sessions a task can drift onto the wrong
   branch; this refuses to proceed on a mismatch (or on `main`). See `docs/agents/worktrees.md`.
2. **Review changes** using `git status` and `git diff`
3. **Stage relevant files** - Be selective, don't use `git add -A`
4. **Write commit message** following conventions
5. **Create commit**

## Commit Message Format

```
<type>: <short description>

<optional body with details>
```

### Types
- `Add` - New feature or file
- `Update` - Enhancement to existing feature
- `Fix` - Bug fix
- `Refactor` - Code restructuring without behavior change
- `Remove` - Removing code or files
- `Docs` - Documentation changes
- `Test` - Adding or updating tests

### Rules
- Never mention Claude, AI, or automated tools
- Keep first line under 70 characters
- Use imperative mood ("Add feature" not "Added feature")
- Focus on what and why, not how

## Examples

Good:
- `Add user avatar upload to profile settings`
- `Fix permission check for event deletion`
- `Update task board to support drag-and-drop reordering`

Bad:
- `Updated stuff` (vague)
- `AI-generated commit` (mentions AI)
- `Fixed the bug that was causing issues` (not specific)

## Commands

```bash
git add <specific-files>
git commit -m "<message>"
```
