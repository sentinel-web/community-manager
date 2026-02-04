# Testing Best Practices and Strategy

This document outlines the testing philosophy, patterns, and best practices for the Community Manager project.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Pyramid](#test-pyramid)
- [Running Tests](#running-tests)
- [Test Organization](#test-organization)
- [Writing Tests](#writing-tests)
- [Testing Patterns by Layer](#testing-patterns-by-layer)
- [Common Pitfalls](#common-pitfalls)
- [Coverage Goals](#coverage-goals)

---

## Testing Philosophy

**Priority:** Correctness > Reliability > Speed > Coverage

Our testing strategy follows these principles:

1. **Test behavior, not implementation** - Tests should verify what code does, not how it does it
2. **Tests are documentation** - Test names and structure should explain the expected behavior
3. **Fast feedback loop** - Unit tests should run quickly to enable rapid iteration
4. **Isolation** - Each test should be independent and not rely on other tests
5. **Determinism** - Tests should produce the same result every time they run

---

## Test Pyramid

We follow the test pyramid approach, with more unit tests at the base and fewer integration tests at the top:

```
        /\
       /  \      E2E Tests (future)
      /----\     - Full user flows
     /      \    - Browser automation
    /--------\   Integration Tests
   /          \  - Meteor methods with DB
  /------------\ - Publications
 /              \- Permission system
/----------------\ Unit Tests
                   - Helper functions
                   - Pure business logic
                   - Validation functions
```

**Current Focus:** Unit tests for helper functions and validation logic

**Future Expansion:**
- Integration tests for Meteor methods and publications
- Component tests for React components
- E2E tests for critical user flows

---

## Running Tests

### Commands

```bash
# Run all tests once (CI mode)
npm test

# Run tests in watch mode with full app context
npm run test-app
```

### Test Output

Tests run on the Meteor server and output to the console:

```
--- RUNNING APP SERVER TESTS ---

getLegibleTextColor
  ✔ returns white text for dark backgrounds
  ✔ returns black text for light backgrounds
  ...

34 passing (47ms)
```

### Environment

- **Framework:** Mocha (via `meteortesting:mocha`)
- **Assertions:** Node.js native `assert` module
- **Entry Point:** `tests/main.js`

---

## Test Organization

### Directory Structure

```
tests/
├── main.js                    # Test entry point (imports all tests)
├── helpers/                   # Unit tests for helper functions
│   └── colors/
│       ├── hexToRgb.test.js
│       ├── getLuminance.test.js
│       ├── getLegibleTextColor.test.js
│       └── parseColor.test.js
├── server/                    # Server-side tests (future)
│   ├── methods/               # Meteor method tests
│   ├── publications/          # Publication tests
│   └── validation/            # Validation function tests
└── client/                    # Client-side tests (future)
    ├── hooks/                 # React hook tests
    └── components/            # Component tests
```

### File Naming

- Test files: `{module}.test.js`
- Test files mirror source structure: `imports/helpers/colors/hexToRgb.js` → `tests/helpers/colors/hexToRgb.test.js`

### Importing Tests

All test files must be imported in `tests/main.js`:

```javascript
// tests/main.js
import './helpers/colors/hexToRgb.test.js';
import './helpers/colors/parseColor.test.js';
import './helpers/colors/getLuminance.test.js';
import './helpers/colors/getLegibleTextColor.test.js';
```

---

## Writing Tests

### Basic Structure

```javascript
/* global describe, it */
import assert from 'node:assert';
import { functionUnderTest } from '/imports/helpers/module.js';

describe('functionUnderTest', () => {
  it('describes expected behavior in plain English', () => {
    // Arrange
    const input = 'test value';
    const expected = 'expected result';

    // Act
    const result = functionUnderTest(input);

    // Assert
    assert.strictEqual(result, expected);
  });
});
```

### Assertion Methods

Use Node.js native `assert` module:

| Method | Use Case | Example |
|--------|----------|---------|
| `assert.strictEqual(a, b)` | Primitive values | `assert.strictEqual(result, 42)` |
| `assert.deepStrictEqual(a, b)` | Arrays/objects | `assert.deepStrictEqual(rgb, [255, 0, 0])` |
| `assert.ok(value)` | Truthy check | `assert.ok(result > 0)` |
| `assert.throws(fn, error)` | Exception thrown | `assert.throws(() => fn(), { message: 'Error' })` |

### Test Naming Conventions

Use descriptive names that explain the expected behavior:

```javascript
// Good - describes behavior
it('returns white text for dark backgrounds', () => { ... });
it('throws an error for invalid hex color', () => { ... });
it('handles shorthand hex notation like #f00', () => { ... });

// Bad - describes implementation
it('calls hexToRgb', () => { ... });
it('uses regex', () => { ... });
```

### Testing Error Cases

Always test that functions handle invalid input correctly:

```javascript
describe('hexToRgb', () => {
  it('throws an error for invalid hex color', () => {
    assert.throws(
      () => hexToRgb('invalid-color'),
      { message: 'Invalid hex color' }
    );
  });

  it('throws an error for hex with invalid characters', () => {
    assert.throws(
      () => hexToRgb('#gggggg'),
      { message: 'Invalid hex color' }
    );
  });
});
```

### Testing Floating-Point Values

Use range assertions for floating-point calculations:

```javascript
it('calculates luminance for mid-gray with gamma correction', () => {
  const luminance = getLuminance(128, 128, 128);
  // Use range assertion due to floating-point precision
  assert.ok(
    luminance > 0.2 && luminance < 0.23,
    `Expected ~0.216, got ${luminance}`
  );
});
```

### Testing Multiple Input Variations

Group related input variations together:

```javascript
describe('hexToRgb', () => {
  describe('valid hex formats', () => {
    it('parses full hex with hash', () => {
      assert.deepStrictEqual(hexToRgb('#ff0000'), [255, 0, 0]);
    });

    it('parses full hex without hash', () => {
      assert.deepStrictEqual(hexToRgb('ff0000'), [255, 0, 0]);
    });

    it('parses shorthand hex', () => {
      assert.deepStrictEqual(hexToRgb('#f00'), [255, 0, 0]);
    });

    it('handles uppercase hex', () => {
      assert.deepStrictEqual(hexToRgb('#FF0000'), [255, 0, 0]);
    });
  });

  describe('invalid inputs', () => {
    it('throws for invalid characters', () => { ... });
    it('throws for wrong length', () => { ... });
  });
});
```

---

## Testing Patterns by Layer

### Helper Functions (Unit Tests)

Test pure functions in isolation:

```javascript
// tests/helpers/colors/hexToRgb.test.js
import assert from 'node:assert';
import { hexToRgb } from '/imports/helpers/colors/hexToRgb.js';

describe('hexToRgb', () => {
  it('converts hex to RGB array', () => {
    assert.deepStrictEqual(hexToRgb('#ff0000'), [255, 0, 0]);
  });
});
```

### Validation Functions (Unit Tests)

Test validation helpers from `server/main.js`:

```javascript
// tests/server/validation/validateString.test.js
import assert from 'node:assert';
import { validateString } from '/server/main.js';

describe('validateString', () => {
  it('accepts valid strings', () => {
    assert.strictEqual(validateString('hello', 'field'), 'hello');
  });

  it('trims whitespace', () => {
    assert.strictEqual(validateString('  hello  ', 'field'), 'hello');
  });

  it('throws for non-string values', () => {
    assert.throws(
      () => validateString(123, 'field'),
      { message: 'field must be a string' }
    );
  });
});
```

### Meteor Methods (Integration Tests)

Test methods with database interaction:

```javascript
// tests/server/methods/members.test.js
/* global describe, it, beforeEach, afterEach */
import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { resetDatabase } from 'meteor/xolvio:cleaner';

describe('members methods', () => {
  beforeEach(async () => {
    await resetDatabase();
    // Create test user
  });

  describe('members.insert', () => {
    it('creates a new member when authorized', async () => {
      // Setup: Create user with permission
      const userId = await createTestUser({ permissions: { members: 'crud' } });

      // Act: Call method as that user
      const result = await Meteor.server.method_handlers['members.insert'].apply(
        { userId },
        [{ username: 'newuser', profile: { name: 'New User' } }]
      );

      // Assert
      assert.ok(result, 'Should return inserted ID');
      const member = await Meteor.users.findOneAsync(result);
      assert.strictEqual(member.username, 'newuser');
    });

    it('throws 401 when not authenticated', async () => {
      await assert.rejects(
        async () => {
          await Meteor.server.method_handlers['members.insert'].apply(
            { userId: null },
            [{ username: 'test' }]
          );
        },
        { error: 401 }
      );
    });

    it('throws 403 when user lacks permission', async () => {
      const userId = await createTestUser({ permissions: { members: 'r' } });

      await assert.rejects(
        async () => {
          await Meteor.server.method_handlers['members.insert'].apply(
            { userId },
            [{ username: 'test' }]
          );
        },
        { error: 403 }
      );
    });
  });
});
```

### Permission System (Integration Tests)

Test the permission checking logic:

```javascript
// tests/server/permissions.test.js
import assert from 'node:assert';
import { checkPermission } from '/server/main.js';

describe('checkPermission', () => {
  it('allows admin users full access', async () => {
    const adminId = await createTestUser({ roles: true });
    await assert.doesNotReject(
      () => checkPermission(adminId, 'members', 'delete')
    );
  });

  it('allows users with specific CRUD permission', async () => {
    const userId = await createTestUser({
      roleId: await createRole({ members: 'crud' })
    });
    await assert.doesNotReject(
      () => checkPermission(userId, 'members', 'create')
    );
  });

  it('denies users without required permission', async () => {
    const userId = await createTestUser({
      roleId: await createRole({ members: 'r' })
    });
    await assert.rejects(
      () => checkPermission(userId, 'members', 'delete'),
      { error: 403 }
    );
  });
});
```

### React Hooks (Client Tests)

Test custom hooks with `@testing-library/react-hooks` (future):

```javascript
// tests/client/hooks/useTranslation.test.js
import { renderHook } from '@testing-library/react-hooks';
import { useTranslation } from '/imports/i18n/LanguageContext.jsx';

describe('useTranslation', () => {
  it('returns translation function', () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: LanguageProvider
    });

    assert.strictEqual(typeof result.current.t, 'function');
  });

  it('translates known keys', () => {
    const { result } = renderHook(() => useTranslation(), {
      wrapper: LanguageProvider
    });

    assert.strictEqual(result.current.t('common.save'), 'Save');
  });
});
```

---

## Common Pitfalls

### 1. Missing Test Imports

Tests won't run unless imported in `tests/main.js`:

```javascript
// tests/main.js - Don't forget to add new test files!
import './helpers/colors/newHelper.test.js';
```

### 2. Using Jest Syntax

This project uses Mocha/assert, not Jest:

```javascript
// Wrong (Jest)
expect(result).toBe(42);
expect(fn).toThrow();

// Correct (Mocha/assert)
assert.strictEqual(result, 42);
assert.throws(() => fn());
```

### 3. Async Test Handling

Async tests must use `async/await` or return a Promise:

```javascript
// Correct
it('handles async operations', async () => {
  const result = await asyncFunction();
  assert.strictEqual(result, 'expected');
});

// Wrong - test passes before async completes
it('handles async operations', () => {
  asyncFunction().then(result => {
    assert.strictEqual(result, 'expected');
  });
});
```

### 4. Floating-Point Comparison

Never use `strictEqual` for floating-point results:

```javascript
// Wrong - may fail due to precision
assert.strictEqual(getLuminance(128, 128, 128), 0.2158605001138992);

// Correct - use range
assert.ok(luminance > 0.21 && luminance < 0.22);
```

### 5. Test Isolation

Don't rely on test execution order:

```javascript
// Wrong - depends on previous test
let sharedState;

it('sets up state', () => {
  sharedState = createSomething();
});

it('uses state', () => {
  assert.ok(sharedState); // May fail if tests run in different order
});

// Correct - each test is independent
it('test one', () => {
  const state = createSomething();
  assert.ok(state);
});

it('test two', () => {
  const state = createSomething();
  assert.ok(state.property);
});
```

### 6. Testing Implementation Details

Test what code does, not how it does it:

```javascript
// Wrong - tests implementation
it('calls internal helper function', () => {
  const spy = sinon.spy(module, '_internalHelper');
  publicFunction();
  assert.ok(spy.called);
});

// Correct - tests behavior
it('returns formatted output', () => {
  const result = publicFunction('input');
  assert.strictEqual(result, 'expected output');
});
```

---

## Coverage Goals

### Current State

| Category | Coverage | Status |
|----------|----------|--------|
| Color helpers | 100% | Complete |
| Other helpers | 0% | Planned |
| Validation functions | 0% | Planned |
| Meteor methods | 0% | Planned |
| Publications | 0% | Planned |
| React components | 0% | Future |
| E2E flows | 0% | Future |

### Target Coverage

**Phase 1 (Current):** Helper functions
- All pure utility functions should have 100% coverage
- Focus on edge cases and error handling

**Phase 2:** Server-side logic
- Validation functions: 100%
- Meteor methods: Critical paths covered
- Permission system: 100%

**Phase 3:** Client-side
- Custom hooks: Key functionality
- Complex components: Integration tests

### What to Test

**Always test:**
- Public API functions
- Input validation and error handling
- Edge cases (empty inputs, boundary values)
- Business logic with calculations

**Skip testing:**
- Simple getters/setters
- Framework boilerplate
- Third-party library behavior
- UI layout/styling (use visual testing instead)

---

## Adding New Tests

### Checklist

1. Create test file mirroring source structure
2. Import test file in `tests/main.js`
3. Write descriptive test names
4. Test both success and error cases
5. Test edge cases and boundary conditions
6. Run `npm test` to verify all tests pass
7. Consider adding tests for related functions

### Template

```javascript
/* global describe, it */
import assert from 'node:assert';
import { myFunction } from '/imports/path/to/module.js';

describe('myFunction', () => {
  describe('valid inputs', () => {
    it('handles typical case', () => {
      const result = myFunction('normal input');
      assert.strictEqual(result, 'expected output');
    });

    it('handles edge case', () => {
      const result = myFunction('');
      assert.strictEqual(result, 'default');
    });
  });

  describe('invalid inputs', () => {
    it('throws for null input', () => {
      assert.throws(
        () => myFunction(null),
        { message: 'Input is required' }
      );
    });
  });
});
```

---

## Resources

- [Mocha Documentation](https://mochajs.org/)
- [Node.js Assert Module](https://nodejs.org/api/assert.html)
- [Meteor Testing Guide](https://guide.meteor.com/testing.html)
- [meteortesting:mocha](https://github.com/meteortesting/meteor-mocha)
