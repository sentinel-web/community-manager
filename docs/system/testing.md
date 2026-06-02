# Testing Strategy

How the test suite is wired and run: an in-process **Mocha** tier executed by Meteor (`npm test`) and an out-of-process **Playwright** end-to-end tier that drives a real browser (`npm run e2e`). This doc maps the mechanics, what actually runs in CI, and the traps around the server/browser split.

> Note: this is a TypeScript-first Meteor 3.4+ app with a generic CRUD factory and a collection registry; tests are `.ts`/`.tsx`, the entry is `tests/main.ts`, and there **is** a Playwright e2e suite (`e2e/`). The product is multilingual (en/de/fr) — there is no German-only naming convention in the test code, so no German glossary is needed here.

## Key files

- `package.json` — `test` / `test-app` scripts (Mocha via `meteortesting:mocha`) and `e2e` / `e2e:ui` / `e2e:headed` / `e2e:debug` (Playwright); `meteor.testModule` points at `tests/main.ts`.
- `tests/main.ts` — the single Mocha entry point; **only** files imported here run. Imports are alphabetical and extension-less (Meteor's compiler chain resolves `.ts` / `.tsx`).
- `tests/server/fixtures.ts` — shared Mocha helpers: `createTestUser` / `createTestRole` / `createTestDoc`, `callAs` (invokes a method handler with a synthetic `this.userId`), `assertRejectsWithCode`, `findLatestAuditLog`, `cleanupFixtures`, and the `test_` `_id`-prefix convention.
- `tests/server/*.test.ts` — server-mode tests (34 files): CRUD, permissions, mutation pipeline, referential integrity, i18n, palette, validation, sanitizer, plus the pure-policy `runMethodCall.test.ts`.
- `tests/client/**/*.test.tsx` — browser-mode tests gated on `Meteor.isClient` (`useMethod`, `useEntityForm`, `drawerStackHooks`); pure-logic siblings (`drawerStackStore.test.ts`, `config.test.ts`) carry no gate and run server-side too.
- `tests/helpers/colors/*.test.ts` — pure-unit color math (4 files).
- `e2e/playwright.config.ts` — Playwright config: `testDir: ./tests`, chromium-only by default, `baseURL` `http://localhost:3000`, auto-starts the app via `webServer: npm start`.
- `e2e/fixtures/auth.fixture.ts` — `login()` / `logout()` helpers + the `authenticatedPage` fixture (logs in as `admin` / `admin`).
- `e2e/pages/*.page.ts` — page-object model: `BasePage` (antd helpers) + `SectionPage`, `LoginPage`, `EventsPage`, `MembersPage`, `TasksPage`, `NavigationPage`.
- `e2e/tests/*.spec.ts` — one spec per navigable view (23 files); mostly `SectionPage`-driven CRUD round-trips.
- `e2e/types/window.d.ts` — augments `Window` with `Meteor` so specs can `page.evaluate(() => window.Meteor.callAsync(...))`.
- `e2e/tsconfig.json` — a separate TS project (`moduleResolution: bundler`, `types: [node, @playwright/test]`) that keeps Playwright types out of the app build.
- `.meteorignore` — excludes all of `e2e/` from Meteor's build/watch (see Gotchas).
- `.github/workflows/ci.yml` — `typecheck` and `lint` jobs run in parallel; the `mocha + e2e` job runs both test tiers.
- `scripts/capture-views.mjs` — standalone Playwright script (not a test) that screenshots every view at desktop + mobile widths into `/tmp`.
- `TESTING.md` (repo root) — the prose strategy guide (philosophy, assertion table, pitfalls). This doc is its structural/wiring companion.

## How it works

Two tiers run independently. `tests/main.ts` is the only file Meteor loads as the test module, so a `.test.ts` file is invisible until it is imported there.

### Tier 1 — Mocha (in-process, run by Meteor)

| | Detail |
|---|---|
| Runner | `meteortesting:mocha` driver package (declared in `.meteor/packages`) |
| Assertions | Node `node:assert` (`strictEqual`, `deepStrictEqual`, `rejects`, `throws`) — **not** Jest / Chai |
| Entry | `tests/main.ts` (`meteor.testModule`) — imports every test file alphabetically |
| Run once | `npm test` → `meteor test --once --driver-package meteortesting:mocha` |
| Watch | `npm run test-app` → `TEST_WATCH=1 meteor test --full-app …` (full app loaded; a browser at `localhost:3000` runs the client-gated tests) |

`meteor test --once` runs **server tests only**. It ends with `RUNNING SERVER TESTS` and prints `Load the app in a browser to run client tests`. No `TEST_BROWSER_DRIVER` is set and no headless browser is wired in, so **`Meteor.isClient`-gated tests never execute in `npm test` or CI** — they run only in `npm run test-app` watch mode with a browser open.

Two modes live inside this tier:

| Mode | Gate | Examples | Runs in CI? |
|------|------|----------|-------------|
| Server | (none — default) | `crudMethods.test.ts`, `permissions.test.ts`, `mutationPipeline.test.ts`, `runMethodCall.test.ts` | Yes |
| Browser | `if (Meteor.isClient) { … }` | `useMethod.test.tsx`, `useEntityForm.test.tsx`, `drawerStackHooks.test.tsx` | No (watch-mode only) |

**Server-mode integration pattern** (`tests/server/fixtures.ts`). Tests do **not** open a DDP connection. `callAs(userId, 'medals.insert', …)` reaches directly into `Meteor.server.method_handlers[name]` and `.apply({ userId }, args)`, so a synthetic `this.userId` exercises the real auth → permission → validate → body → audit path. Fixtures create docs with `test_`-prefixed `_id`s; `cleanupFixtures([...extraCollections])` then range-deletes (`_id >= 'test_'` and `< 'test`'`, an indexed `IXSCAN`) across `Meteor.users`, roles, and logs, plus any extra collections the caller declares, and calls `clearRoleCache()`. Tests scope cleanup to the collections they touched rather than wiping everything.

Fixture helpers (`tests/server/fixtures.ts`):

| Helper | Purpose |
|--------|---------|
| `createTestRole(perms)` | Insert a `test_`-prefixed role doc; returns its `_id`. |
| `createTestUser({ roleId, profile, _id })` | Insert a `test_`-prefixed `Meteor.users` doc; returns its `_id`. Pass `_id` to override (caller then owns cleanup, since a non-prefixed id falls outside the range delete). |
| `createTestDoc(Collection, data)` | Insert a `test_`-prefixed doc into any project collection; returns its `_id`. |
| `callAs(userId, methodName, ...args)` | Invoke a registered method handler with `this.userId = userId`; throws if the method is not registered. |
| `assertRejectsWithCode(fn, code)` | Assert `fn()` rejects with `(err as Meteor.Error).error === code`. |
| `findLatestAuditLog(action, payloadId)` | Fetch the newest `Logs` entry for `{ action, 'payload.id': payloadId }`. |
| `cleanupFixtures(extraCollections?)` | Range-delete all `test_` docs across users/roles/logs + extras, then `clearRoleCache()`. |

**Browser-mode pattern** (`tests/client/**`). Real components/hooks render into a live DOM via `react-dom/client` + `act()`, with the modules under test pulled in by `require()` (not `import`) to dodge load-order issues. `useMethod.test.tsx` mounts the hook under a real antd `<App>` and captures the same `message` / `notification` instances the hook receives (antd memoizes the context value, so the sibling capturer and the hook share one object reference), then stubs `Meteor.callAsync` to assert loading/data/error transitions and contextual feedback. It restores `Meteor.callAsync` in `afterEach`.

**The MethodCall seam is tested in two halves.** The pure policy core is `tests/server/runMethodCall.test.ts` (no React, no DOM → runs in CI). It asserts the discriminated result `{ ok:true, data } | { ok:false, error }`, that `undefined` is a *void success* (not a failure), `(data) => string` success messages, the `message = err.error` / `description = clean err.reason` extraction (falling back to `err.message` when there is no reason), and `notify:false` silence. The thin React wiring is smoke-tested separately in `tests/client/hooks/useMethod.test.tsx` (browser-only). This is the deliberate "mirror DOM logic with a pure server test so CI guards it" doctrine — see also `drawerStackStore.test.ts` (server, no gate) vs `drawerStackHooks.test.tsx` (browser).

**Circular-dep `require` pattern.** `server/crud.lib.ts` and `server/main.ts` form an init-time cycle, so tests that need `getCollection` import its *type* but load the *value* lazily via `require('../../server/crud.lib').getCollection` inside the test body, by which point all modules are initialized.

### Tier 2 — Playwright (out-of-process, real browser)

| | Detail |
|---|---|
| Config | `e2e/playwright.config.ts` (passed via `--config=e2e/playwright.config.ts` in every `e2e*` script) |
| Test dir | `e2e/tests/` (`testDir: ./tests`, relative to the config) |
| App boot | `webServer: { command: 'npm start', url: 'http://localhost:3000', reuseExistingServer: !CI, timeout: 120000 }` — reuses a running dev server locally, boots a fresh one in CI |
| Browser | chromium only (Firefox commented out; opt in with `--project=firefox`) |
| Timeouts | `timeout: 30000` per test, `expect.timeout: 10000` |
| Retries / workers | `retries: 2`, `workers: 1` in CI; `retries: 1`, `workers: 5` locally; `fullyParallel: true` |
| Artifacts | `trace: on-first-retry`, `screenshot: only-on-failure`, `video: retain-on-failure`; HTML report → `e2e/playwright-report/`, results → `e2e/test-results/` |

**Auth.** `e2e/fixtures/auth.fixture.ts` exports `login()` (fills the antd login form as `admin` / `admin`, waits for `nav button`) and an extended `test` with an `authenticatedPage` fixture. Most specs call `login(page)` in `beforeEach`. The dev admin exists only when `NODE_ENV !== 'production'`.

**Page-object model.** `BasePage` wraps antd quirks: `fillFormItem` / `fillFormField`, `selectOption`, `waitForDrawerOpen` / `waitForDrawerClose`, `submitForm` (scoped to `.ant-drawer-footer` to avoid the hidden Enter-to-submit button), `confirmPopconfirm`. `SectionPage(page, route)` is the generic CRUD driver: `goto` (waits on `.ant-table, .ant-empty`), `search`, `clickCreate`, `deleteRow` (targets the modal `.ant-btn-primary` by class to stay label/locale-agnostic), and **auto-retrying assertions** (`expectRowVisible`, `expectRowHidden`, `expectEmptyTable`, `expectValidationError`) built on Playwright `expect(locator)`.

**Driving Meteor directly.** `e2e/types/window.d.ts` exposes `window.Meteor`, so specs can bypass the UI for setup/teardown via `page.evaluate(() => window.Meteor.callAsync(...))`. `demoData.generate` (dev-only, full DB reset) is the documented hard state-reset hatch — it churns the admin `_id` and kills the session, so use it as a *between-test* reset, never mid-flow.

### CI (`.github/workflows/ci.yml`)

| Job | Steps | Meteor binary needed? |
|-----|-------|----------------------|
| `typecheck` | `npm ci` → `npm run typecheck` (`tsc --noEmit`) | No (ambient `meteor/*` decls in `imports/types/meteor.d.ts` satisfy resolution) |
| `lint` | `npm ci` → `npm run lint` (eslint) | No |
| `mocha + e2e` | cache + install Meteor → `meteor npm ci` → `meteor npm test` → `npx playwright install --with-deps chromium` → `meteor npm run e2e` | Yes |

`typecheck` and `lint` run in parallel as fast pure-Node jobs. The `mocha + e2e` job runs the Mocha suite first, then e2e; the Playwright report (`e2e/playwright-report/`) and traces (`e2e/test-results/`) upload as artifacts on failure. The workflow token is `contents: read` only; `forbidOnly` and `workers: 1` are forced on by `process.env.CI`.

## What is unit vs integration vs e2e (and current coverage)

| Test | Tier | Kind |
|------|------|------|
| `tests/helpers/colors/*.test.ts` | server | pure unit (color math) |
| `tests/server/validation.test.ts` | server | pure unit (validators) |
| `tests/server/runMethodCall.test.ts`, `paletteScoring/Search/Recents`, `i18n.*`, `htmlSanitizer.test.ts` | server | pure unit (policy / pure logic) |
| `tests/server/crudMethods.test.ts`, `permissions.test.ts`, `mutationPipeline.test.ts`, `*Methods.test.ts` | server | integration (real method handlers + DB via `callAs`) |
| `tests/server/integrity*.test.ts`, `backupRestore.test.ts` | server | integration (FK graph, backup round-trips) |
| `tests/client/**/*.test.tsx` | browser | component/hook integration (live DOM) — **not in CI** |
| `e2e/tests/*.spec.ts` | Playwright | full-stack e2e (real browser + running app) |

**Honest coverage picture.** The server tier is broad: it covers the CRUD factory, the mutation pipeline, RBAC/permissions, referential integrity (the largest single file, `integrity.test.ts`), backup/restore, sanitization, i18n invariants, the command palette, and per-feature method modules (members, registrations, settings, specializations, briefing templates). It does **not** approach line coverage of every server API; modules without a `*Methods.test.ts` rely on the shared CRUD-factory tests for their generated `.read/.insert/.update/.delete/.count/.options` behavior, and there is no coverage tooling wired in (no nyc/istanbul). The browser tier is small (three hook/component tests) and does not run in CI. The e2e tier has one spec per navigable view (23 specs) but is mostly happy-path CRUD round-trips, not exhaustive edge-case coverage. There is no `git`/snapshot-diff guard on translations beyond `i18n.invariants.test.ts`.

## Adding a test

**Server (Mocha) test** — the common case:

1. Create `tests/server/<feature>.test.ts`.
2. Import fixtures: `import { callAs, createTestUser, createTestRole, cleanupFixtures } from './fixtures';`.
3. Use `describe` / `it` (ambient `@types/mocha` globals — never `import from 'mocha'`).
4. Assert with `node:assert`; for method calls use `callAs(userId, 'collection.method', ...args)` so you control `this.userId`. Use `assertRejectsWithCode(fn, 401|403|...)` for denials.
5. Create fixtures with the helpers (so `_id`s carry the `test_` prefix) and tear them down in `after`/`afterEach` via `cleanupFixtures([...collectionsYouTouched])`.
6. **Add the import to `tests/main.ts`** — extension-less, in alphabetical position. Without this line the file never runs.
7. Run `npm test`.

**Browser (component/hook) test:**

1. Create `tests/client/**/<thing>.test.tsx` and wrap the whole body in `if (Meteor.isClient) { … }`.
2. `require()` (do not `import`) the module under test and `react-dom/client` / `react-dom/test-utils`; render into a real DOM node inside `act()`.
3. Add the import to `tests/main.ts`.
4. Remember it runs **only** in `npm run test-app` (watch mode, browser open) — never in CI. If the logic needs a CI guard, mirror it in a pure server test (the `runMethodCall` / `drawerStackStore` pattern) or cover it with an e2e spec.

**E2E (Playwright) test:**

1. Create `e2e/tests/<view>.spec.ts`; import `test` from `@playwright/test` (or the extended `test` from `e2e/fixtures/auth.fixture.ts`).
2. Drive the UI through a page object (`SectionPage(page, route)` for a standard CRUD view) and assert with auto-retrying `expect(locator)`.
3. Log in via `login(page)` in `beforeEach`; reset state with `window.Meteor.callAsync('demoData.generate')` between tests if needed.
4. Run `npm run e2e` (needs a dev server on `:3000` or it boots one).

## Gotchas

- **`npm test` does not run client tests.** Anything inside `if (Meteor.isClient)` is invisible to CI. Never rely on a browser-only test as a regression guard — mirror its logic in a pure server test or cover it with a Playwright spec.
- **A new test file does nothing until it's imported in `tests/main.ts`** — and the imports are extension-less and alphabetical; preserve both.
- **Use `node:assert`, not Jest.** `expect().toBe()` / `.toThrow()` do not exist in the Mocha tier. (Playwright specs *do* use `expect`, but that's `@playwright/test`'s — a different API.)
- **Server tests don't use a DDP connection.** Drive methods through `callAs` (`Meteor.server.method_handlers[...]`), not `Meteor.callAsync`, so you control `this.userId`.
- **Clean up with the `test_` prefix.** Always create fixtures via the helpers and let `cleanupFixtures()` range-delete; ad-hoc docs with non-prefixed `_id`s leak across runs. Overriding `createTestUser({ _id })` opts out of the range delete — you then own cleanup.
- **`crud.lib` ↔ `main.ts` is a require-cycle.** In a test, `require()` `getCollection` lazily inside the test body; a top-level `import` of the *value* can hit a half-initialized module.
- **`.meteorignore` must exclude all of `e2e/`** (a bare `e2e/` line). A *partial* exclude leaves Playwright's transient writes (`test-results/`, traces) visible to Meteor's file watcher, triggering a mid-test `forceBrowserReload` / HMR that wipes form state and notifications and flakes the run. Same reason `capture-views.mjs` writes screenshots to `/tmp`.
- **Running `npm test` while `meteor run` (the dev server) is up desyncs the dev server's method registry** — both share `.meteor/local`. Recover by restarting the dev server.
- **`webServer.reuseExistingServer` is `!CI`.** Locally Playwright attaches to whatever is on `:3000`; if that server is on a stale build, e2e tests test stale code. Restart it first.
- **`demoData.generate` is destructive and dev-only.** It wipes every collection and rotates the admin `_id`, ending the current session — use it as a between-test reset, never mid-flow.
- **Mocha types are ambient.** `describe`/`it`/`before`/`after` come from `@types/mocha` via tsconfig `types`; never `import` from `'mocha'`.

## See also

- [crud-engine.md](./crud-engine.md) — the generated methods/pipeline that `crudMethods.test.ts` and `mutationPipeline.test.ts` exercise via `callAs`.
- [permissions-rbac.md](./permissions-rbac.md) — `checkPermission` + role cache; `permissions.test.ts` and `clearRoleCache()` in fixtures.
- [referential-integrity.md](./referential-integrity.md) — the FK subsystem behind `integrity*.test.ts`.
- [crud-engine.md](./crud-engine.md) — validators and audit logging exercised by `validation.test.ts` and `findLatestAuditLog`.
- [request-lifecycle.md](./request-lifecycle.md) — the client-call → method path the MethodCall seam tests cover.
- [ui-architecture.md](./ui-architecture.md) — DrawerStack / `useMethod` / `useEntityForm`, mirrored by the browser-mode tests and the page-object model.
- `TESTING.md` (repo root) — philosophy, assertion table, naming, pitfalls (prose companion to this doc).
- `CLAUDE.md` → *Testing* and *Common Gotchas*; `README.md`; `docs/plans/` (design + plan docs).
