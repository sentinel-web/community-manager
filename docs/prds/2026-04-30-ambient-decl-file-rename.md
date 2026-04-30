# PRD: Rename `meteor-globals.d.ts` → `ambient.d.ts`

**Date:** 2026-04-30
**Status:** Draft
**Author:** Migration follow-up after M8 (PR #96)
**Estimated effort:** 30 minutes

---

## Problem

`imports/types/meteor-globals.d.ts` is now misnamed. Original purpose: augment Meteor module types (`meteor/mongo`, `meteor/meteor`). After M7 Batch 5 (PR #94) and M8 strict mode work:

- File contains 4 ambient module declarations for `react-big-calendar` (and CSS modules)
- File contains 1 ambient module declaration for `react-beautiful-dnd` (added during M8 — actually, dropped in favor of `@types/react-beautiful-dnd`, so this is hypothetical)
- File contains 2 augmentations for Meteor packages

The Batch 5 cross-cutting reviewer flagged this in the PR description and recommended deferral to M8. M8 didn't address it. Now lingers as cosmetic debt.

Severity: LOW. Zero runtime impact. Doesn't block any work. Pure organizational nit.

## Goal

Rename `meteor-globals.d.ts` to `ambient.d.ts` (or split into multiple files) so the filename matches the contents.

## Non-goals

- Adding new ambient declarations.
- Removing existing declarations (the `react-big-calendar` decl is still load-bearing — no `@types` package exists).
- Changing the contents of any declaration block.

## Approach

### Option A — Single rename

Move `imports/types/meteor-globals.d.ts` → `imports/types/ambient.d.ts`. Verify tsconfig `include` glob (`imports/**/*`) still picks it up. Done.

**Pros:** Single file, one git rename, zero churn.
**Cons:** File still mixes concerns (Meteor augmentations + third-party module shims).

### Option B — Split by concern

Split into:
- `imports/types/meteor.d.ts` — keep `declare module 'meteor/mongo'` and `declare module 'meteor/meteor'` augmentations
- `imports/types/react-big-calendar.d.ts` — full ambient declarations for the lib + DnD addon + CSS module shims

**Pros:** Each file is single-purpose; future readers find the right file by name.
**Cons:** Two file additions, slightly more git noise.

**Recommendation:** **Option B**. The cost is ~10 minutes for clarity that pays back forever. Aligns with the "co-locate types with their domain" pattern Batch 5's cross-cutting reviewer suggested.

### Workflow (Option B)

1. `git mv imports/types/meteor-globals.d.ts imports/types/meteor.d.ts`
2. Read `meteor.d.ts`. Cut out the `react-big-calendar` blocks (and the 2 CSS module shims).
3. Create `imports/types/react-big-calendar.d.ts`. Paste the cut content.
4. Verify `npx tsc --noEmit` is clean (ambient declarations are auto-discovered via `tsconfig.include`).
5. Commit:
   ```
   chore(types): split ambient declarations by concern
   ```

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| TS doesn't auto-discover the new `react-big-calendar.d.ts` | Should be auto-found via `tsconfig.include: ["imports/**/*"]`. Verify with `npx tsc --noEmit` immediately after the split. |
| Some other ambient .d.ts file in `imports/types/` references identifiers from the old name | None should — ambient declarations are global, not imported. Verify via `grep -rn "meteor-globals"` (filename references in comments or build configs). |
| Build pipeline references the old filename | Search `package.json`, Meteor settings, any build scripts. Memory says the file isn't referenced outside ambient discovery. |

## Success criteria

- [ ] `imports/types/meteor-globals.d.ts` no longer exists
- [ ] `imports/types/meteor.d.ts` exists with only `declare module 'meteor/*'` augmentations
- [ ] `imports/types/react-big-calendar.d.ts` exists with the lib + DnD + CSS module ambient decls
- [ ] `npx tsc --noEmit` clean
- [ ] `npm test` shows 168 passing
- [ ] No `grep -rn "meteor-globals"` results across the codebase

## Out-of-scope follow-ups

- Adding `@types/react-big-calendar` if such a package gets published (would obsolete the ambient file).
- Splitting the Meteor augmentations themselves (mongo + meteor in one file is fine — they're related).

## Open questions

1. Are there other `.d.ts` files in `imports/types/` that should also be renamed/organized? (Run `ls imports/types/` first.)
2. Does the Meteor build pipeline have any reference to the old filename? (Almost certainly not, but verify.)
