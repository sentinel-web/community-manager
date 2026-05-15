# React Doctor

Static-analysis health check for the codebase. Bundles oxlint (perf / hooks / correctness rules), knip (dead-code finder), and TypeScript checks into a single CLI from million.co.

## Running

```bash
npm run doctor       # perf / correctness / architecture / a11y — skips dead-code (recommended default)
npm run doctor:full  # the above + knip's dead-code scan
```

The default script passes `--no-dead-code` because knip needs project-specific configuration to understand Meteor's entry-point convention (see "Known noise" below). Use `doctor:full` after teaching knip about Meteor.

## Known noise — read before chasing findings

- **`no-react19-deprecated-apis` (33 hits at last scan)** — false positive on a React 18 codebase. The rule's `help` text claims "Only enabled on projects detected as React 19+" but it fires on `^18.3.1` anyway. Ignore until upstream fixes the detection, or until we upgrade to React 19.
- **`rules-of-hooks` error in `e2e/fixtures/auth.fixture.ts:59`** — false positive on Playwright's `use` parameter (named like React's `use` hook). Suppress with `// oxlint-disable-next-line rules-of-hooks` if it stays distracting.
- **`knip:files` "Unused file" on `client/main.tsx`, `server/main.ts`, `server/crud.lib.ts`, etc. (~10,400 hits)** — knip looks at `package.json`'s `main`/`bin` for entry points; Meteor's convention of auto-loading `client/main.tsx` + `server/main.ts` is invisible to it. Run `npm run doctor:full` only after adding a `knip.json` that whitelists those paths.

## What's worth fixing — initial scan baseline

Score: **78 / 100 ("Great")**. 200 actionable issues across 77 of 231 source files, dominated by:

| Category | Count | Headline rules |
|---|---|---|
| Performance | 101 | `async-await-in-loop` (28), `async-parallel` (23), `js-combine-iterations` (19), `js-index-maps` (8) |
| Architecture | 47 | `no-react19-deprecated-apis` (33 — false positive), `no-generic-handler-names` (10), `no-barrel-import` (2) |
| State & Effects | 23 | `no-cascading-set-state` (9), `prefer-useReducer` (7), `no-derived-state-effect` (3), `rerender-*` (8) |
| Correctness | 18 | `no-array-index-as-key` (15) |
| Server | 5 | `server-sequential-independent-await` (5) |
| Bundle Size | 3 | misc |
| Accessibility | 3 | jsx-a11y rules |

The Performance + Server sequential-await findings are the highest-leverage starting points: each one is a `Promise.all` away from a real latency win.

## Workflow suggestions

- **Pre-PR**: `npm run doctor` locally, eyeball the new findings introduced by your branch. Use `--diff main` to scope to the diff.
- **Diagnosis**: when a finding is unclear, `npx react-doctor --explain path/to/file.tsx:42` prints the rule's full reasoning.
- **CI**: not wired up yet. If we want it as a check, the `--fail-on warning` flag exits non-zero on any warning; `--annotations` emits GitHub Actions inline annotations.

## Pinning

Pinned via `react-doctor` in `devDependencies` (currently `^0.1.6`). Upgrade with `npm install --save-dev react-doctor@latest`; expect the rule set to grow and known false-positives to potentially flip — re-read this doc's "Known noise" section after upgrades.
