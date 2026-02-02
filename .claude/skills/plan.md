# /plan

Create or refine an implementation plan for the current issue.

## Usage
`/plan` - Create implementation plan based on current context
`/plan refine` - Refine existing plan based on feedback

## Instructions

1. **Review context** - Check current branch name, any existing plan, and issue details
2. **Analyze codebase** - Identify relevant files, patterns, and dependencies
3. **Design approach** - Follow existing patterns from CLAUDE.md
4. **Break down tasks** - Create specific, actionable steps
5. **Identify risks** - Note potential issues or edge cases

## Plan Structure

```markdown
## Implementation Plan: <Feature/Fix Name>

### Overview
<Brief description of the approach>

### Prerequisites
- <Any setup or dependencies needed>

### Tasks

#### 1. <Task Name>
- **Files:** `path/to/file.js`
- **Changes:** <What to modify>
- **Details:** <How to implement>

#### 2. <Task Name>
...

### Testing Strategy
- <How to verify the implementation>

### Risks & Considerations
- <Potential issues to watch for>
```

## Guidelines

- Follow priority order: Security → Performance → Usability → Developer Experience
- Use existing patterns from the codebase
- Keep changes minimal and focused
- Consider permission requirements for new features
- Plan for audit logging on mutations

After creating the plan, ask if the user wants to document it in the GitHub issue.
