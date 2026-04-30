# Tracer bullet: enable Rspack on a feature branch and validate one full path

**Type:** Tracer bullet for [Rspack Bundler Adoption PRD](../prds/2026-04-30-rspack-bundler-adoption.md)
**Status:** Open
**Effort:** ~60–90 minutes
**Why this slice:** Smallest end-to-end proof. We need to know — *before* committing to a full migration plan — whether the four highest-risk integration points work for *this* codebase:

1. `meteor add rspack` succeeds against our exact `.meteor/packages` set (`accounts-password`, `meteortesting:mocha`, `react-meteor-data`, `static-html`, etc.)
2. The app boots in dev mode and login flow (Meteor accounts) functions
3. HMR triggers on a React/antd component edit (proves the SWC + React + antd-v5 ESM path)
4. `npm test` still passes 168 mocha unit tests under Rspack

If those four pass, the remaining adoption work in the PRD is mechanical (config, Docker, measurement). If any fails, we stop and re-plan instead of finding out mid-migration.

## Scope

**Touch only:**
- A new feature branch: `feature/rspack-tracer-bullet`
- `.meteor/packages` — adds `rspack`
- Possibly a minimal `rspack.config.js` at project root (only if smoke test fails without one)
- A throwaway log/notes file for measurements (do NOT commit)

**Do not touch:**
- `Dockerfile`, `docker-compose.yml`
- Any application code in `imports/`, `server/`, `client/`
- `tsconfig.json`
- `package.json` scripts or deps
- `CLAUDE.md` (that update belongs to the full PRD execution, not the tracer)
- `tests/` — only run them, don't modify

## Pre-conditions to verify

Run these *before* `meteor add rspack`:

```bash
# 1. Confirm Meteor 3.4+ (Rspack requires this)
cat .meteor/release   # expect METEOR@3.4 or newer

# 2. Confirm mainModule is declared (Rspack needs explicit entries)
node -e "console.log(require('./package.json').meteor)"

# 3. Audit for nested imports — Meteor's nonstandard pattern that Rspack rejects
grep -rn "import(" imports/ server/ client/ | grep -v "node_modules"
# Inspect manually: any import() inside if/try/while/function bodies needs evaluation
# Standard top-level dynamic import() and route-level import() are FINE
# What's banned is e.g.: function load() { if (cond) { import('./foo') } }

# 4. Check for reserved folder collisions
ls _build public/build-assets public/build-chunks private/build-assets private/build-chunks 2>/dev/null
# Expect: all "No such file or directory" — these are Rspack-reserved
```

If any pre-condition fails, **stop and document** in the issue thread before adopting.

## Implementation steps

1. **Branch off main**: `git checkout -b feature/rspack-tracer-bullet`
2. **Capture baseline timings** (legacy bundler, before any change):
   - `time meteor build /tmp/baseline-build --architecture os.linux.x86_64` (or just `meteor run` cold-start time from logs)
   - Note the output bundle size: `du -sh /tmp/baseline-build/*.tar.gz`
   - Save numbers in a local note (do not commit)
3. **Add the package**: `meteor add rspack`
   - Expect `.meteor/packages` to gain a `rspack` line
   - Expect `package.json` to gain `@meteorjs/rspack` in devDependencies (Meteor's installer wires it)
4. **Boot the dev server**: `npm start`
   - Watch for build errors. SWC errors usually point to syntax it can't handle.
   - First boot will be slower (cold cache); kill, restart, measure warm boot
5. **Smoke test in browser** (http://localhost:3000):
   - Login with `admin` / `admin`
   - Navigate to Members section — a page loads, table renders, antd styling intact
   - Open one member drawer — drawer animates in, form populates with data
   - Edit one field, save — confirm Meteor method round-trip works
6. **HMR check**:
   - Edit `imports/ui/members/MembersTable.tsx` (or any visible component) — change a label
   - Confirm browser updates without full reload
7. **Tests**: `npm test`
   - Must show 168 passing
   - If failures, capture stderr for the issue thread
8. **(Optional, if time permits) prod build smoke**: `meteor build /tmp/rspack-build --architecture os.linux.x86_64`
   - Compare bundle size to baseline
   - Try `cd /tmp/rspack-build/bundle && node main.js` (with MONGO_URL set) — does it boot?
9. **Document numbers and findings** in the issue thread (or PR description if opening one):
   - Cold build before / after
   - Warm rebuild before / after
   - Prod bundle size before / after (if step 8 done)
   - Any errors, warnings, or surprises
10. **Decision point**: keep the branch around as the foundation for the full PRD execution, or revert if blockers found.

## Acceptance criteria

- [ ] `.meteor/packages` contains `rspack` line, no other unintended diff
- [ ] `npm start` boots; login page renders; `admin` / `admin` works
- [ ] One Section page (Members) renders with antd styling intact
- [ ] HMR works on at least one component edit
- [ ] `npm test` shows 168 passing
- [ ] Baseline + Rspack timing/size measurements captured (in issue or PR description)
- [ ] No application code changed
- [ ] No `// @ts-ignore`, `as any`, or quick-fix hacks introduced

## Likely surprises (and what to do)

| Surprise | What to do |
|---------|-----------|
| `meteor add rspack` fails with version error | Check Meteor release; may need `meteor update --release 3.4.1`. Document and stop. |
| Login flow breaks (accounts-password incompatible) | Rare — accounts-password is core. Check console for module-resolution errors; capture stack and stop. |
| antd styles missing / broken | Check Network tab for CSS load failures. Likely auto-delegation didn't pick something up; document and try a minimal CSS rule in `rspack.config.js`. |
| `react-beautiful-dnd` warnings or runtime crash on Tasks page | It's already deprecated; Rspack's stricter ESM may surface what webpack masked. Document and decide: babel-isolate for this dep, or accept and replace lib later. |
| `npm test` fails with module-resolution errors | Most likely culprit: the `crud.lib.js` ↔ `main.js` circular dep noted in MEMORY.md. Document; this becomes a PRD risk to address before full adoption. |
| HMR works but is full-reload-only for some files | Could be Blaze (we don't use Blaze), or a misconfigured loader. Document. |
| Cold build is *slower* than legacy on first run | Expected — persistent cache is empty. Warm build is the real comparison. |
| Prod build (`meteor build`) hangs or OOMs | `TOOL_NODE_FLAGS="--max-old-space-size=16384" meteor build …` per Meteor docs. Document if needed. |
| `_build/` folder appears in repo root | Expected. Confirm it's gitignored (Rspack auto-adds, or add manually). |

## Output / hand-off

The deliverable is a **decision artifact**, not a merged change. Outputs:

1. A summary in this issue (or a tracer-bullet PR description) with:
   - Pass/fail on each acceptance criterion
   - Measured numbers (cold/warm/prod size, before/after)
   - List of surprises encountered, with classification (showstopper / annoyance / non-issue)
   - Recommendation: proceed with full PRD / re-scope PRD / abandon
2. The `feature/rspack-tracer-bullet` branch left intact — full PRD execution branches from it
3. Updates to the [PRD](../prds/2026-04-30-rspack-bundler-adoption.md) "Open questions" section for any answered

If the tracer bullet succeeds end-to-end, the next slice is the full PRD execution: prod Docker build, measurement, CLAUDE.md update, and merge to main.
