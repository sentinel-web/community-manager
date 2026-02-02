# /issue

Fetch and analyze a GitHub issue to start implementation work.

## Usage
`/issue <number>` - Fetch issue by number
`/issue` - If on a branch like `feature/issue-123-*`, fetch issue #123

## Instructions

1. **Fetch the issue** using `gh issue view <number>`
2. **Analyze requirements** - Identify what needs to be done
3. **Identify affected areas** - Which files, collections, or components are involved
4. **List questions** - Any ambiguities that need clarification
5. **Create initial plan outline** - High-level implementation approach

## Output Format

```
## Issue #<number>: <title>

### Summary
<Brief description of the issue>

### Requirements
- <Requirement 1>
- <Requirement 2>

### Affected Areas
- <File/component 1>
- <File/component 2>

### Questions
- <Question 1 if any>

### Initial Plan
1. <Step 1>
2. <Step 2>
```

After analysis, ask if the user wants to proceed with `/plan` to create a detailed implementation plan.
