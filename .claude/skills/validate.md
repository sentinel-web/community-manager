# /validate

Validate code against CLAUDE.md patterns and suggest updates if new patterns emerge.

## Usage
`/validate` - Validate recent changes
`/validate <file>` - Validate specific file
`/validate --update` - Also update CLAUDE.md if new patterns found

## Instructions

1. **Read CLAUDE.md** to understand documented patterns
2. **Analyze changed files** for pattern compliance
3. **Identify new patterns** that should be documented
4. **Report findings**

## Validation Points

### Architecture Compliance
- Files in correct directories
- Following permission system patterns
- Using CRUD generation for collections
- Proper state management approach

### Coding Guidelines Compliance
- Priority order respected (Security → Performance → Usability → DX)
- Modern design patterns (DRY, KISS, YAGNI, SOLID)
- Server-side patterns (async, validation, permissions, logging)
- Client-side patterns (hooks, PropTypes, error handling)

### New Pattern Detection
Look for:
- New utility functions that could be reused
- New component patterns
- New API patterns
- Configuration approaches

## Output Format

```
## Validation Report

### Compliance: <PASS/FAIL>

### Pattern Violations
- <Violation 1 with file and line>
- <Violation 2>

### New Patterns Detected
- <Pattern description> in `<file>`
  - Recommend adding to CLAUDE.md: <Yes/No>

### Suggested CLAUDE.md Updates
<If any new patterns should be documented>
```

If `--update` flag is used and new patterns are found, propose edits to CLAUDE.md.
