# /pr

Create a pull request with summary and testing steps.

## Usage
`/pr` - Create PR for current branch

## Instructions

1. **Check branch status**
   - Ensure all changes are committed
   - Verify branch is pushed to remote
   - Check tests pass (`npm test`)

2. **Analyze changes**
   - Review all commits on the branch
   - Identify affected files and features
   - Note any breaking changes

3. **Generate PR content**
   - Write clear title (under 70 chars)
   - Summarize changes in bullet points
   - List testing/reproduction steps

4. **Create PR** using `gh pr create`

## PR Template

```markdown
## Summary
- <Change 1>
- <Change 2>
- <Change 3>

## Test Plan
1. <Step to test/reproduce>
2. <Expected result>
3. <Additional verification>

## Related Issue
Closes #<issue-number>
```

## Pre-PR Checklist

Before creating the PR, verify:
- [ ] All tests pass (`npm test`)
- [ ] Code follows CLAUDE.md guidelines
- [ ] No console.log or debug code left
- [ ] Permissions checked for new features
- [ ] Audit logging added for mutations

## Commands

```bash
git push -u origin <branch-name>
gh pr create --title "<title>" --body "<body>"
```
