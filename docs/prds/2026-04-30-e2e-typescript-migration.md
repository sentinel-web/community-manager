# PRD: Migrate `e2e/` (Playwright) Folder to TypeScript

**Date:** 2026-04-30
**Status:** Draft
**Author:** Migration follow-up after M8 (PR #96)
**Estimated effort:** 6–10 hours (depends on test count and shared-helper depth)

---

## Problem

Playwright e2e tests in `e2e/` are still JavaScript while the rest of the codebase is fully TypeScript with `strict: true`. Memory note: "108 tests across 20 routes." Concrete pain points:

- No type safety on selectors, locators, fixtures, or page objects
- Implicit-any in `expect()` chains makes the IDE useless for autocomplete
- Test helpers (auth setup, subscription stabilization, drag-and-drop wait timings) aren't type-checked, so a typo in a CollectionSelect-stabilization wait can fail silently
- Playwright ships first-class TypeScript types — the migration cost is mostly mechanical
- `e2e/` is `exclude`-d from tsconfig (line 28), so even renaming files to `.ts` won't trigger checks until tsconfig is touched

## Goal

Migrate the `e2e/` folder to TypeScript with full type-safety via Playwright's native types. Run e2e suite under TS unchanged (zero behavior changes).

## Non-goals

- Rewriting test scenarios. Spec-compliance applies: every Playwright test must produce identical actions in identical order.
- Switching from Playwright to another e2e framework.
- Adding new e2e tests.
- Running e2e tests in CI (separate concern).

## Approach

### Scope

Survey before starting (count is "108 tests across 20 routes" per memory, but file structure unknown):

```bash
find e2e -name "*.js" -type f | wc -l
find e2e -name "*.spec.js" -type f | wc -l   # actual test files
find e2e -name "*.ts" -type f                # any pre-existing TS
```

Likely structure:
- `e2e/playwright.config.js` (test runner config)
- `e2e/fixtures/` or `e2e/helpers/` (shared utilities — auth login, subscription waiters, drag-drop timing)
- `e2e/specs/` or per-feature folders (the 108 tests)

### Workflow

1. **Inventory phase**: `find e2e -type f` and categorize files (config, helpers, fixtures, specs).
2. **Add to tsconfig**: create separate `e2e/tsconfig.json` extending root, OR remove `e2e` from root's `exclude`. Separate config preferred — Playwright's compile target may differ from Meteor's, and we don't want e2e's `process.env.PLAYWRIGHT_*` types polluting app code.
3. **Migrate `playwright.config.js`** first: imports `defineConfig` from `@playwright/test`, fully typed.
4. **Migrate helpers/fixtures**: type the page-object models, fixture builders. Memory note: "CollectionSelect loads options async via WebSocket subscription - add 500ms stabilization wait + retry loop" — this helper logic must keep its retry/timeout semantics intact.
5. **Migrate spec files** in dependency order: simplest (single-route tests) first; complex orchestration (cross-route flows) last.
6. **Verify**: run `npx playwright test` with the same env. All 108 tests must still pass with 0 flakiness (the existing baseline per memory).

### Type sources

- `@playwright/test` — built-in `Page`, `Locator`, `expect`, `test`, etc.
- `@types/node` for Node globals (`process.env`, etc.)
- Project types: import `Member`, `Task` from `imports/api/types/` if specs assert on data shapes. Cross-folder imports require pathing in e2e tsconfig.

### Conventions

Same M7 patterns where applicable:
- Function components → not relevant (no React in e2e)
- Auto-retrying assertions: `await expect(locator).toBeVisible()` (per memory) — Playwright's `expect` is already typed correctly
- `waitForTimeout` antipattern except for documented cases (300ms drawer animation, 500ms subscription stabilization, 1000ms drag-and-drop) — preserve exactly
- Fixture builders typed with explicit return types
- Page object model: `class MembersPage { constructor(private page: Page) {} ... }` if the codebase uses POMs; otherwise functional helpers

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| `@playwright/test` types conflict with Meteor's vendored types | Separate `e2e/tsconfig.json` keeps test types isolated from app types |
| Specs that use `page.evaluate(() => Meteor.callAsync(...))` (per memory: "for test setup, use page.evaluate + Meteor.callAsync to bypass UI forms") need typed Meteor reference inside the browser context | `page.evaluate` callback runs in the browser; typing the inner closure requires `(window as { Meteor: typeof import('meteor/meteor').Meteor }).Meteor` or similar. Add a `e2e/types/window.d.ts` ambient decl |
| Flaky test timing — strict mode adds no flakiness, but a typo in a TS migration could change a `waitForTimeout(500)` to `waitForTimeout(5000)` accidentally | Diff every spec line-by-line; reuse the spec-compliance reviewer pattern from M7 |
| 108 tests is a lot to migrate manually | Subagent dispatch per route folder, like the M7 batches |
| `playwright.config.js` may use `commonJS` patterns that need `module: 'CommonJS'` in e2e tsconfig | Inspect during inventory phase, set tsconfig accordingly |

## Success criteria

- [ ] All `e2e/*.js` files renamed to `.ts`, content retyped under `strict: true`
- [ ] `e2e/tsconfig.json` exists and extends root with appropriate overrides
- [ ] `npx tsc --noEmit -p e2e/tsconfig.json` clean
- [ ] `npx playwright test` shows the same 108 passing tests with 0 flakiness
- [ ] No `// @ts-ignore`, no `as any` apart from documented `window` access in `page.evaluate`
- [ ] Selectors typed via `Locator` (`page.locator('...')` returns `Locator`)
- [ ] Helper functions have explicit return types

## Out-of-scope follow-ups

- Add `playwright-vscode` or similar IDE integration
- Visual regression testing
- Cross-browser test matrix expansion
- e2e in CI pipeline

## Open questions

1. Is there a `playwright.config.js` defining the test matrix, or are tests configured per-spec?
2. Does the existing test suite use Playwright's project-based parallelism, sharding, or fixtures-per-test pattern?
3. Are there `globalSetup`/`globalTeardown` files that need TS types for `FullConfig`?
4. Should we migrate to Playwright's `test.extend()` fixture pattern as part of this, or keep current setup?
