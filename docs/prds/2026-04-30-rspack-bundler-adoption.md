# PRD: Adopt Rspack as the Meteor Build Bundler

**Date:** 2026-04-30
**Status:** Draft
**Author:** Build-perf follow-up after M8 TS migration
**Estimated effort:** 6–10 hours (incl. config + audit + verification)

---

## Problem

We're on Meteor 3.4 with the legacy `ecmascript` + `standard-minifier-js` + `standard-minifier-css` build stack. Day-to-day this means:

- Cold builds are slow (Babel-based transpilation across the full app + antd tree)
- Production bundles ship more antd than we use — no real tree-shaking from the legacy linker
- HMR works for React but rebuild round-trips noticeably lag on `imports/ui/**` edits
- The bundler doesn't see ESM exports as ESM, so import-level dead-code elimination is best-effort

Meteor 3.4 added a **first-class Rspack integration** (the new "modern build stack"), and 3.4.1 hardened it. Reported gains: ~4× build speed, ~8× smaller bundles, real tree-shaking, Rust-based SWC transpile, persistent caching, native HMR. The `mainModule` entry points the project already declares in `package.json` are exactly the contract Rspack requires.

This is the moment to adopt it: TS migration M1–M8 is merged, the codebase is fully strict TS, no Babel macros, antd v5 is ESM, no Vite/`jorgenvatle:vite` legacy to undo.

## Goal

Replace the legacy Meteor build stack with Rspack as the primary bundler for `community-manager`, keeping all current functionality (HMR, tests, e2e, Docker build) intact and producing measurably smaller production bundles + faster dev rebuilds.

## Non-goals

- Switching frameworks or upgrading React/antd majors
- Migrating the e2e harness — Playwright runs against the served app, bundler-agnostic
- Changing the test runner (`meteortesting:mocha` stays)
- Introducing a separate dev/prod toolchain (Vite, Turbopack, etc.) — Rspack is the only target
- Reorganizing the `imports/`/`server/`/`client/` layout
- Code-splitting work beyond what Rspack does automatically (separate follow-up if we want route-level chunks)

## Approach

### Pre-flight audit (must pass before any config changes)

Rspack's hard requirements vs. our codebase:

| Requirement | Current state | Action |
|------------|----------------|--------|
| `package.json#meteor.mainModule` declared | ✅ already set (`client/main.tsx`, `server/main.ts`) | None |
| No nested `import()` inside conditionals/functions (Meteor's nonstandard nested-imports) | Unknown — needs grep | Audit: `grep -rn "import(" imports/ server/ client/` and inspect each |
| Reserved folders not used: `_build`, `{public,private}/build-{assets,chunks}` | Likely clean | Verify; add to `.gitignore` if missing (Rspack does this automatically but confirm) |
| Atmosphere build plugins compatible | Currently using only `ecmascript`, `typescript`, `static-html`, `react-meteor-data` — all compatible | None |
| antd ESM imports (so tree-shaking is effective) | Already `import { X } from 'antd'` style throughout | None |

### Adoption steps

1. **Tracer bullet** (separate issue): adopt Rspack on a feature branch with minimal config, confirm dev server boots, app loads, login works, one CRUD page renders. Document baseline timings.
2. **Add the package**: `meteor add rspack` — installs `@meteorjs/rspack` at the project level on first run.
3. **Create `rspack.config.js`** at project root using the `defineConfig(Meteor => …)` form. Start minimal:
   ```js
   const { defineConfig } = require('@meteorjs/rspack');
   module.exports = defineConfig(Meteor => ({
     // antd v5 is ESM; named imports tree-shake automatically — no extra config needed
     // Add Meteor.splitVendorChunk() once we measure baseline bundle stats
   }));
   ```
4. **Verify HMR**: edit an `imports/ui/**` component, confirm fast-refresh works. (Blaze is N/A — we're React-only.)
5. **Verify CSS**: antd uses CSS-in-JS, but the project may import `.css` somewhere — inventory with `grep -rn "import.*\.css" imports/ client/`. CSS handling is auto-delegated in 3.4.1; only intervene if something breaks.
6. **Verify tests**: `npm test` still passes 168 unit tests; `meteor test --full-app` works (3.4.1 fixed multi-instance Rspack here).
7. **Verify e2e**: `npm run e2e` against the Rspack-built dev server. No bundler-level changes expected; Playwright sees served app only.
8. **Measure**: capture before/after numbers — cold build, warm rebuild, prod bundle size, prod gzip size.
9. **Update Docker build**: `Dockerfile` should pick up Rspack automatically since `meteor build` honors the bundler setting, but verify. Also add `meteor update --npm` step if not present (CI/Docker requirement per Meteor docs).
10. **Update `CLAUDE.md`**: add a "Build stack" subsection under Architecture noting Rspack is the active bundler, with the `rspack.config.js` location and a pointer to the persistent cache (`_build/`).
11. **Update `.gitignore`** if Rspack didn't auto-add the reserved folders.

### Configuration we may need over time (deferred — start minimal)

- `Meteor.splitVendorChunk()` — once we see actual chunk sizes, may help cache invalidation
- `Meteor.extendSwcConfig(...)` — only if some TS feature isn't supported by SWC defaults (unlikely; we don't use stage-3 proposals)
- Tailwind/PostCSS — N/A (we use antd, not Tailwind)
- SCSS/Less loaders — N/A (no `.scss`/`.less` in tree)
- React Compiler — opt-in later if we want; out of scope

### Tooling considerations

- **`tsconfig.json`** stays as-is. Rspack's SWC reads its own config (`swc.config.ts` if we add one) but defaults to honoring `tsconfig.json` for paths/strictness. Verify `paths` aliases (if any) work — none currently.
- **`.meteor/local/types`** — Meteor's autogenerated types stay; tsconfig include already has them.
- **Persistent cache** lives in `_build/`. Add to `.gitignore` (auto), and to CI cache key if we want CI rebuild speedups later.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Rspack adoption breaks Meteor's `accounts-password` flow or other Atmosphere packages | Tracer bullet validates login. If broken, file upstream; fall back to legacy bundler is one `meteor remove rspack` away. |
| `react-beautiful-dnd` (deprecated, peer-dep warnings) doesn't tree-shake or behaves oddly under SWC | Smoke-test the Tasks Kanban page in tracer bullet. If broken, isolate via babel for that one package or pin to legacy bundler. |
| `react-big-calendar` SCSS imports (it ships some default styles) confuse the new CSS pipeline | Auto-delegation in 3.4.1 should handle; if not, add a CSS rule in `rspack.config.js`. |
| Prod build via `meteor build` produces a bundle that doesn't run on Node 20 in Docker | Validate in the staging Docker build before any deploy. Keep a known-good legacy bundle as rollback. |
| `meteor test --full-app` (which we run for e2e setup) doesn't cooperate with Rspack | 3.4.1 specifically fixed this. If still broken, document and hold migration. |
| Bundle size doesn't actually shrink (we already import antd granularly) | This is fine — even a 1.5× build-speed win pays back the migration cost. Document actual numbers. |
| Persistent cache (`_build/`) bloats local disk | Add `_build/` to a periodic-clean script if it grows; document in CLAUDE.md. |
| Rspack 2.x breaking changes between minor versions during early adoption | Pin `@meteorjs/rspack` to a known-good version; review release notes before bumping. |
| Meteor `testModule: tests/main.js` setting doesn't pick up Rspack's resolution rules | Tested by `npm test`. If broken, may need to update path or settings. |

## Success criteria

- [ ] `meteor add rspack` clean, project boots via `npm start`
- [ ] `rspack.config.js` exists at project root with the minimal `defineConfig` shell
- [ ] Login + at least one Section page (Members) loads end-to-end in dev
- [ ] HMR works on a React component edit (no full reload)
- [ ] `npm test` passes 168 unit tests
- [ ] `npm run e2e` passes 108 e2e tests
- [ ] Production bundle built via `meteor build` boots in Docker, login + Members page work
- [ ] Documented before/after numbers in PR description: cold build, warm rebuild, prod bundle size (uncompressed + gzip)
- [ ] `CLAUDE.md` updated with build-stack note
- [ ] No `// @ts-ignore`, no `as any`, no Babel-runtime workarounds added

## Out-of-scope follow-ups

- **Vendor chunk splitting** (`Meteor.splitVendorChunk()`) once baseline numbers exist
- **Route-level code splitting** for `imports/ui/{events,tasks,orbat,…}/` — we currently load everything upfront
- **React Compiler** opt-in
- **Service worker / PWA** setup — interesting for offline-friendly community managers but separate
- **CI build cache** keyed on `_build/` for shared runner speedups
- **swc.config.ts** for fine-tuning if SWC defaults aren't enough

## Open questions

1. Does our `Dockerfile` invoke `meteor build` in a way that honors the Rspack setting, or is the bundler choice baked into `.meteor/packages` and just works? (Answered by tracer bullet's prod-build step.)
2. Is `@types/meteor@2.9.11` aware of the `@meteorjs/rspack` types, or do we need a new `@types/*` install?
3. `react-beautiful-dnd` is deprecated upstream — does Rspack's tree-shaking surface dead code in it that breaks runtime, or does it behave like webpack? (Tracer bullet smoke-tests Tasks page.)
4. Do we want to set `verbose: true` for `meteor.modern` during adoption to see Rspack internals, or trust the simplified logs?
5. Should the persistent cache `_build/` be cleaned in `npm run update` to avoid stale-cache surprises after dependency upgrades?

## Reference

- [Meteor Rspack Bundler Integration docs](https://docs.meteor.com/about/modern-build-stack/rspack-bundler-integration.html)
- [Meteor 3.4.1 release notes](https://dev.to/meteor/meteor-341-is-out-rspack-consolidation-revitalized-examples-and-important-fixes-4lac)
- [Meteor-Rspack 3.4 announcement thread](https://forums.meteor.com/t/meteor-rspack-integration-a-modern-bundler-meets-meteor-3-4/63696)
