# Tracer bullet: migrate `tests/helpers/colors/getLuminance.test.js` to TypeScript

**Type:** Tracer bullet for [Tests TS Migration PRD](../prds/2026-04-30-tests-typescript-migration.md)
**Status:** Open
**Effort:** ~30 minutes
**Why this slice:** Smallest possible test file (~10–20 lines, 4 mocha cases). Proves end-to-end that:
1. Adding `tests/**/*` to tsconfig.include doesn't blow up the rest of the codebase under `strict: true`
2. Mocha types are available (either via `@types/mocha` or `tsconfig.types`)
3. Imports from `imports/helpers/colors/getLuminance.ts` (already TS) work — no path-alias surprises
4. Node `assert` works under `useUnknownInCatchVariables`
5. Meteor's bundler picks up `tests/main.js` references to a `.ts` test file (or whether `tests/main.js` itself needs touching)

If this 30-minute slice passes, the remaining 10 test files are mechanical extensions of the same pattern.

## Scope

**Touch only:**
- `tests/helpers/colors/getLuminance.test.js` → rename to `.ts`, add types
- `tsconfig.json` — add `"tests/**/*"` to `include`
- `tests/main.js` — update the import line for getLuminance.test (do NOT migrate `tests/main.js` itself yet — keep `.js`, just update the path inside)

**Do not touch:**
- Any other `tests/*.js` file
- Fixture builders
- Any `imports/`, `server/`, `client/` source

## Implementation steps

1. `git mv tests/helpers/colors/getLuminance.test.js tests/helpers/colors/getLuminance.test.ts`
2. Add types to function signatures, narrow `assert.throws` callback args if any.
3. Apply `/* global describe, it */` removal — replace with `import { describe, it } from 'mocha'` if `@types/mocha` is present, OR add `"types": ["node", "mocha"]` to tsconfig.
4. Update `tsconfig.json` `include`: `["imports/**/*", "server/**/*", "client/**/*", "tests/**/*", ".meteor/local/types/**/*.d.ts"]`
5. Update `tests/main.js` import path (drop `.js` extension if present, since `.ts` resolves automatically).
6. Run `npx tsc --noEmit` — must be clean (will likely fail initially — fix only the issues in the migrated file + tsconfig include side effects).
7. Run `npm test` — must show 168 passing.

## Acceptance criteria

- [ ] `tests/helpers/colors/getLuminance.test.ts` exists, `.js` removed
- [ ] `tsconfig.json` includes `tests/**/*`
- [ ] `npx tsc --noEmit` clean across full codebase under `strict: true`
- [ ] `npm test` shows 168 passing
- [ ] No `// @ts-ignore`, no `as any`
- [ ] Test count unchanged (4 cases for getLuminance, depending on actual file)

## Likely surprises (and what to do)

| Surprise | What to do |
|---------|-----------|
| Adding tsconfig include surfaces 50+ implicit-any errors in OTHER untouched .js test files | Expected — the goal is to count them. Document the count in the PR. The next slice (tracer bullet → batch 2) addresses them. |
| `@types/mocha` not in `node_modules` | Install as devDep: `npm install --save-dev @types/mocha`, document in commit message |
| Meteor's `meteor test` command can't find a `.ts` test file | Falls into the "open question" bucket of the PRD. Stop and report — this changes the migration approach. |
| `tests/main.js` has dynamic `import()` calls that need typing | Out of scope for this slice — leave `tests/main.js` as-is, only update the one import line for getLuminance |

## Output / hand-off

Open a PR titled `chore(tests): tracer-bullet migrate getLuminance.test to TypeScript`. Include:
- The test file diff
- The tsconfig include change
- The error count from `npx tsc --noEmit` if any from other test files (documents the remaining work for the next slice)
- An update to the [PRD](../prds/2026-04-30-tests-typescript-migration.md) "Open questions" section if the slice answers any.
