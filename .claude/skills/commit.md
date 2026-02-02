# /commit

Create a commit with a clean, descriptive message.

## Usage
`/commit` - Stage and commit current changes
`/commit <message>` - Commit with provided message

## Instructions

1. **Review changes** using `git status` and `git diff`
2. **Stage relevant files** - Be selective, don't use `git add -A`
3. **Write commit message** following conventions
4. **Create commit**

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
