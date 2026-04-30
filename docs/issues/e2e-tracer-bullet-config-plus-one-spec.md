# Tracer bullet: migrate `e2e/playwright.config.js` + one simple spec to TypeScript

**Type:** Tracer bullet for [E2E TS Migration PRD](../prds/2026-04-30-e2e-typescript-migration.md)
**Status:** Open
**Effort:** 1–2 hours
**Why this slice:** The `e2e/` migration has more open questions than `tests/` because Playwright's bundler runs separately from Meteor. This slice answers the architecture-validating questions before committing to migrating 108 specs. It proves:

1. A separate `e2e/tsconfig.json` correctly extends the root and resolves Playwright's types
2. `defineConfig` from `@playwright/test` works under `strict: true`
3. ONE simple spec passes both typecheck and `npx playwright test`
4. The `page.evaluate(() => Meteor.callAsync(...))` pattern (per memory: used to bypass UI forms during setup) types correctly via a `e2e/types/window.d.ts` ambient decl
5. The 500ms / 300ms / 1000ms `waitForTimeout` patterns survive type-checking unchanged

If this 1–2 hour slice passes, the remaining 107 specs are mechanical.

## Scope

**Touch:**
- `e2e/playwright.config.js` → `.ts` (typed `defineConfig`)
- ONE simple spec file (pick the simplest single-route test — likely a "loads" or "renders" spec). Goal: minimum logical complexity, smallest blast radius.
- New: `e2e/tsconfig.json` extending root with overrides for Playwright
- New: `e2e/types/window.d.ts` (only if a `page.evaluate(Meteor)` access pattern is in the chosen spec)

**Do not touch:**
- Any other `*.spec.js` file
- Fixture builders / page object models / shared helpers (next slice)
- Root `tsconfig.json` exclude (keep `e2e` excluded; the new e2e config is independent)

## Implementation steps

1. **Inventory first** — `find e2e -type f -name "*.js" | head -20`. Identify the simplest spec (smallest file, single page, no fixtures). Document the choice in the PR description.
2. Create `e2e/tsconfig.json`:
   ```json
   {
     "extends": "../tsconfig.json",
     "compilerOptions": {
       "noEmit": true,
       "types": ["node", "@playwright/test"]
     },
     "include": ["**/*.ts"],
     "exclude": ["node_modules"]
   }
   ```
3. `git mv e2e/playwright.config.js e2e/playwright.config.ts`. Replace JSDoc-typed config with `import { defineConfig } from '@playwright/test'; export default defineConfig({ ... })`.
4. `git mv` the chosen spec file `.js` → `.ts`. Add types to `test()` and `expect()` chains. Most types come for free via Playwright's `test` import.
5. If the spec uses `page.evaluate(() => Meteor.callAsync(...))`, create `e2e/types/window.d.ts`:
   ```ts
   import type { Meteor as MeteorNS } from 'meteor/meteor';
   declare global {
     interface Window {
       Meteor: typeof MeteorNS;
     }
   }
   export {};
   ```
6. Run `npx tsc --noEmit -p e2e/tsconfig.json` — must be clean.
7. Run `npx playwright test e2e/<chosen-spec>.ts` — must pass.

## Acceptance criteria

- [ ] `e2e/playwright.config.ts` exists, `.js` removed
- [ ] One spec file migrated, the rest still `.js`
- [ ] `e2e/tsconfig.json` exists, extends root, isolates Playwright types
- [ ] `npx tsc --noEmit -p e2e/tsconfig.json` clean
- [ ] `npx playwright test e2e/<chosen-spec>.ts` passes (same pass/fail as before migration)
- [ ] If `page.evaluate(Meteor.X)` pattern used: ambient decl exists at `e2e/types/window.d.ts`, no `as any`
- [ ] Spec's runtime behavior identical to original — same selectors, same assertions, same waitForTimeout values

## Likely surprises (and what to do)

| Surprise | What to do |
|---------|-----------|
| Playwright config uses `require()` for plugins | Convert to `import` syntax (Playwright 1.x supports both); doc the change |
| Spec uses `test.use({ storageState: '...' })` for auth — no type changes needed but storageState path may need updating | None — paths work identically in TS |
| Tests run in CI via a separate command pointing at `.js` paths | Out of scope for this slice — note it for the full migration |
| `module: ESNext` in extended root tsconfig conflicts with Playwright's CommonJS expectations | Override `module: 'CommonJS'` in `e2e/tsconfig.json` |
| `commonjs` mode breaks `import` syntax | Keep `module: 'ESNext'` — Playwright supports ESM specs; verify with the chosen spec running |

## Output / hand-off

Open a PR titled `chore(e2e): tracer-bullet migrate Playwright config + one spec to TypeScript`. Include:
- The chosen spec name + reasoning ("simplest because: single route, no fixture, no `page.evaluate`")
- Full e2e/tsconfig.json contents
- Output of `npx playwright test e2e/<chosen-spec>.ts` showing pass
- Update to the [PRD](../prds/2026-04-30-e2e-typescript-migration.md) "Open questions" — answered ones move to the body
