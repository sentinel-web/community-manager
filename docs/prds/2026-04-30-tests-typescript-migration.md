# PRD: Migrate `tests/` Folder to TypeScript

**Date:** 2026-04-30
**Status:** Draft
**Author:** Migration follow-up after M8 (PR #96)
**Estimated effort:** 4–6 hours

---

## Problem

The TypeScript migration milestones M1–M8 covered `imports/`, `server/`, and `client/`, but explicitly excluded `tests/`. Result:

- 168 mocha tests still in `.js` files using `import`/`require` mix
- No type checking on test setup, fixtures, or assertions — runtime errors only catch issues post-deployment
- Test files reach into typed source code (e.g. `imports/api/types/`, `server/main.ts`) but lose all type benefits the moment they import via JS
- Inconsistent with the rest of the codebase: `CLAUDE.md` now says "fully TypeScript" but `tests/` is the asterisk

The `tests/` folder is also excluded from `tsconfig.json`'s `include`, so even if a test file were `.ts`, it wouldn't get strict-mode treatment.

## Goal

Migrate all 11 test files in `tests/` to TypeScript with `strict: true`, integrated into the project's tsconfig include path.

## Non-goals

- Rewriting test logic. Migration must preserve test behavior byte-for-byte (same M7 spec-compliance discipline).
- Migrating `e2e/` (Playwright) — separate PRD.
- Switching from mocha to a different test runner.
- Adding new tests.

## Approach

### Scope (11 files)

```
tests/main.js                              # test root, imports all
tests/server/fixtures.js                   # shared test data builders
tests/server/validation.test.js            # ~43 validation helper tests
tests/server/getCollection.test.js         # ~22 collection-lookup tests
tests/server/permissions.test.js           # ~25 permission-check tests
tests/server/questionnaireInterval.test.js # ~9 questionnaire interval tests
tests/server/crudMethods.test.js           # ~4 validatePublish tests
tests/helpers/colors/getLuminance.test.js
tests/helpers/colors/parseColor.test.js
tests/helpers/colors/hexToRgb.test.js
tests/helpers/colors/getLegibleTextColor.test.js  # if present
```

### Workflow

1. **Pre-work**: Add `tests/**/*` to tsconfig `include`. Run typecheck — surfaces all the implicit-any errors from the JS files immediately.
2. **Migrate fixtures first** (`tests/server/fixtures.js`): typing the test data builders propagates types into every test that imports from them.
3. **Migrate helper tests** (3-4 files in `tests/helpers/`): smallest, most mechanical.
4. **Migrate server tests** in dependency order: `getCollection.test.js` → `validation.test.js` → `crudMethods.test.js` → `permissions.test.js` → `questionnaireInterval.test.js`.
5. **Migrate `tests/main.js`** last — it imports every other test file, so renaming has cascading effects.
6. **Update `package.json`** if `meteor.testModule` setting points at `tests/main.js`.

### Type sources

- `Member`, `Task`, etc. from existing `imports/api/types/`
- Mocha types: `@types/mocha` (already in deps via Meteor packages, but verify)
- Node assert: `import assert from 'node:assert'` already typed
- Server-side test access uses `require()` for `crud.lib` (circular-dep workaround, per memory). TS supports `require()` via `@types/node` — keep the pattern.

### Conventions to apply

Same as M7 batches:
- Function signatures with explicit param types (no implicit any)
- Narrow `Meteor.callAsync<T>` returns
- TS interfaces for fixture-builder return types
- No `prop-types` imports
- `useUnknownInCatchVariables` will require narrowing in `try/catch` blocks (likely several in fixtures)

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Strict-mode errors balloon when `tests/**/*` is added to include | Migrate in isolation: do `include: ["tests/**/*"]`-only run first, count errors, batch fixes |
| Circular dep between `crud.lib` and `main` (memory note) breaks under stricter resolution | Keep `require()` calls verbatim; `tsconfig.module: ESNext` allows interop |
| Mocha global types (`describe`, `it`, `before`, `after`) | Already declared via `/* global describe, it */` comment per memory pattern. Replace with `import { describe, it } from 'mocha'` (cleaner under strict) or add to `tsconfig.types: ["node", "mocha"]` |
| `meteor.testModule` setting in `package.json` references `.js` path | Update to `.ts` after rename |
| Fixture builders rely on dynamic property access (`fixture.users[id]`) | Type as `Record<string, Member>` or use indexed access types |

## Success criteria

- [ ] All 11 `tests/*.js` files renamed to `.ts`, content retyped under `strict: true`
- [ ] `tsconfig.json` `include` updated: `tests/**/*` added
- [ ] `npx tsc --noEmit` clean across full codebase
- [ ] `npm test` shows 168 passing (no regressions, no skipped tests)
- [ ] No new `as any`, `as unknown as`, or `// @ts-ignore` introduced (apart from the established `crud.lib` `require` pattern)
- [ ] No PropTypes references, no `import PropTypes` left

## Out-of-scope follow-ups

- Reorganize fixtures into per-collection files (currently flat)
- Add type-level assertions (e.g. `expectType<Member>(...)`) — separate ergonomics work
- Migrate `e2e/` (Playwright) — separate PRD

## Open questions

1. Does `meteor.testModule` need updating, or does Meteor auto-detect `.ts`?
2. Is there a way to run tests with type-checking (mocha-typescript, ts-node) for local dev — or only via Meteor's bundler?
3. Should `tests/server/fixtures.ts` export a single `buildFixtures()` function or a record of builders?
