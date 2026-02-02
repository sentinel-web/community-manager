# /test

Run tests, analyze failures, and suggest fixes.

## Usage
`/test` - Run all tests once
`/test watch` - Run tests in watch mode
`/test <pattern>` - Run tests matching pattern

## Instructions

1. **Run tests** using appropriate npm command
2. **Capture output** including any failures
3. **Analyze failures** - identify root cause
4. **Suggest fixes** with code examples

## Commands

```bash
npm test                    # Run once
npm run test-app           # Watch mode with full app
```

## Failure Analysis

When tests fail:

1. **Identify the failing test** - file and test name
2. **Read the test code** to understand expectations
3. **Read the implementation** being tested
4. **Compare expected vs actual** behavior
5. **Identify root cause** - is it test or implementation issue?
6. **Suggest fix** with specific code changes

## Output Format

```
## Test Results

### Summary
- Total: <count>
- Passed: <count>
- Failed: <count>

### Failures

#### <Test Name>
- **File:** `tests/path/to/test.js`
- **Error:** <error message>
- **Expected:** <expected behavior>
- **Actual:** <actual behavior>
- **Root Cause:** <analysis>
- **Suggested Fix:**
  ```javascript
  // Code fix here
  ```

### Recommendations
<Any additional suggestions>
```

## Test Patterns

This project uses:
- **Mocha** for test framework
- **Chai** for assertions
- Tests in `tests/` directory
- Import tests through `tests/main.js`
