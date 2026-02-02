# /branch

Create a properly named branch from the current issue.

## Usage
`/branch <issue-number>` - Create branch for specific issue
`/branch` - Prompt for issue number

## Instructions

1. **Get issue details** using `gh issue view <number>`
2. **Generate branch name** following the pattern:
   - Features: `feature/issue-<number>-<short-description>`
   - Bugs: `fix/issue-<number>-<short-description>`
   - Refactors: `refactor/issue-<number>-<short-description>`
3. **Create and checkout branch** from main

## Branch Naming Rules

- Use lowercase letters, numbers, and hyphens only
- Keep description short (2-4 words)
- Use issue number for traceability

## Examples

- Issue #45 "Add user avatar upload" → `feature/issue-45-user-avatar-upload`
- Issue #46 "Fix login redirect loop" → `fix/issue-46-login-redirect-loop`
- Issue #47 "Refactor permission system" → `refactor/issue-47-permission-system`

## Commands

```bash
git checkout main
git pull origin main
git checkout -b <branch-name>
```

After creating the branch, suggest running `/plan` if no implementation plan exists.
