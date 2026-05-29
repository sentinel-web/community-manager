# Self-healing e2e specs

Playwright specs in `e2e/` are this repo's flakiest surface — not because the app
is flaky, but because Meteor's cold boot and method-registry desyncs make timing
and selectors brittle. This is a planner → generator → **healer** loop so a flake
gets repaired instead of silently retried-until-green.

## Planner → generator → healer

1. **Planner** — given a `/verify` golden path (or a `verify-contract.md` from
   #278), state the spec's steps as observable assertions, preferring
   `data-verify-*` / stable attributes over localized text or antd class names.
   (`data-verify-*` is a convention to introduce — none exist yet; #278 adds the
   `verify.md` *Stable selectors* guidance.)
2. **Generator** — write the spec against `e2e/playwright.config.ts`, reusing the
   existing auth/setup fixtures rather than re-implementing login.
3. **Healer** — when a spec fails, **diagnose before re-deriving**:
   - Is it a *real* regression? Then the spec is doing its job — stop and report,
     do not "heal" it green.
   - Is it a *selector* break (markup/i18n changed)? Re-derive against a stable
     `data-verify-*` attribute and add one if missing (don't pin to brittle text).
   - Is it a *timing* break (Meteor cold boot / registry desync)? Wait on the
     condition, not a fixed sleep; confirm the server is actually up before driving.

The healer re-derives selectors and stabilizes waits; it never weakens an
assertion or deletes a failing check to pass.

## Known flake causes in this repo

Encode these so the healer doesn't rediscover them each time:

- **Cold boot** — first `meteor`/`npm start` rebuilds; don't drive until
  `http://localhost:3000` actually responds (a fixed timeout will flake).
- **Method-registry desync** — `meteor test` colliding with a running dev server
  through a shared `.meteor/local` desyncs the method registry; run e2e against
  its own instance (and see `docs/agents/worktrees.md` — worktrees keep their own
  `.meteor/local` for exactly this reason).
- **`.meteorignore` must exclude all of `e2e/`** — a partial exclude leaves
  Playwright's transient writes visible to Meteor's HMR, triggering a mid-test
  `forceBrowserReload` that wipes form state and notifications.
- **Ant DatePicker `Enter`** — pressing Enter in an antd DatePicker can submit the
  surrounding form unexpectedly; select the date explicitly instead.

## Guardrail

Self-healing is for **selector and timing** flake only. A healer that can turn a
real failure green is worse than a flaky test — keep the loop able to *repair how
it observes*, never *what it accepts*.
