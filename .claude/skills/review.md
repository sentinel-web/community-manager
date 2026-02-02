# /review

Run code review on staged or changed files against coding guidelines.

## Usage
`/review` - Review all uncommitted changes
`/review staged` - Review only staged changes
`/review <file>` - Review specific file

## Instructions

1. **Identify files to review** using `git status` and `git diff`
2. **Read each changed file**
3. **Check against CLAUDE.md guidelines**
4. **Report findings**

## Review Checklist

### Security
- [ ] Input validation on all user inputs
- [ ] Permission checks before operations
- [ ] No sensitive data exposure
- [ ] Proper error messages (no stack traces to client)
- [ ] Authentication verified (`this.userId` check)

### Performance
- [ ] Efficient database queries (proper filters, limits)
- [ ] Appropriate use of `useCallback` and `useMemo`
- [ ] No unnecessary re-renders
- [ ] Subscriptions have proper filters

### Code Quality
- [ ] Follows existing patterns in codebase
- [ ] DRY - no code duplication
- [ ] KISS - simple, readable solutions
- [ ] YAGNI - no unused code or over-engineering
- [ ] PropTypes defined for all components
- [ ] Proper error handling

### Meteor Specific
- [ ] Using `*Async` collection methods on server
- [ ] Using `Meteor.Error(code, message)` not generic Error
- [ ] Audit logging with `createLog()` for mutations
- [ ] Proper use of `useFind`, `useSubscribe`, `useTracker`

## Output Format

```
## Code Review: <files reviewed>

### Issues Found

#### Critical
- <Security or major issues>

#### Improvements
- <Suggested improvements>

#### Minor
- <Style or minor issues>

### Summary
<Overall assessment and recommendations>
```
