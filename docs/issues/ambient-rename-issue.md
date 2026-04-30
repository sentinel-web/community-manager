# Issue: rename `imports/types/meteor-globals.d.ts` and split ambient declarations

**Type:** Implementation of [Ambient Decl File Rename PRD](../prds/2026-04-30-ambient-decl-file-rename.md)
**Status:** Open
**Effort:** 30 minutes

> **Note on tracer-bullet framing:** The PRD itself is small enough that there is no smaller "tracer" inside it — this issue **is** the full implementation. Splitting it into smaller increments would create more git noise than value.

## Scope

**Touch:**
- `imports/types/meteor-globals.d.ts` (delete)
- `imports/types/meteor.d.ts` (new — Meteor module augmentations only)
- `imports/types/react-big-calendar.d.ts` (new — full ambient declaration for the lib + DnD addon + 2 CSS module shims)

**Do not touch:**
- Any source file (no `import` paths change — ambient declarations are global, not imported)
- Build pipeline configs

## Implementation steps

1. Read `imports/types/meteor-globals.d.ts`. Identify two logical sections:
   - Lines ~1–85: `react-big-calendar` ambient module + DnD addon + 2 CSS module shims
   - Lines ~87–end: `declare module 'meteor/mongo' { ... }` and `declare module 'meteor/meteor' { ... }`
2. Create `imports/types/meteor.d.ts`. Copy the Meteor augmentations into it.
3. Create `imports/types/react-big-calendar.d.ts`. Copy the third-party blocks into it.
4. Delete `imports/types/meteor-globals.d.ts`.
5. Run `npx tsc --noEmit` — must be clean. Ambient declarations are auto-discovered via `tsconfig.include: ["imports/**/*"]`.
6. Run `npm test` — must show 168 passing.
7. Run `grep -rn "meteor-globals" .` — must return no results (no broken comment references).

## Acceptance criteria

- [ ] `imports/types/meteor-globals.d.ts` deleted
- [ ] `imports/types/meteor.d.ts` exists, contains only `declare module 'meteor/*'` augmentations
- [ ] `imports/types/react-big-calendar.d.ts` exists, contains the lib + DnD + CSS module shims
- [ ] `npx tsc --noEmit` clean
- [ ] `npm test` shows 168 passing
- [ ] `grep -rn "meteor-globals"` returns zero matches across the codebase

## Likely surprises (and what to do)

| Surprise | What to do |
|---------|-----------|
| TS doesn't auto-discover the new files | Confirm `tsconfig.include` covers `imports/types/`. It should via the `imports/**/*` glob. Re-run typecheck. |
| A test or build script references the old filename in a string | grep flagged it — update those references in the same commit |
| `@types/react-big-calendar` is installable | Check `npm view @types/react-big-calendar` — if it exists, replace the ambient decl with the package install. **Only do this if the package version aligns with the version of `react-big-calendar` in dependencies.** Otherwise stick with the ambient decl. |

## Output / hand-off

Open a PR titled `chore(types): split ambient declarations by concern`. Include:
- The 3-file diff (1 deletion, 2 additions)
- Verification that `npx tsc --noEmit` is clean and 168 tests pass
- A note in the PRD body marking it Done.

## Cross-reference

If this lands **before** the `tests/` migration tracer bullet, no impact. If it lands **after**, the `tests/` migration may need to update one comment if a fixture file references `meteor-globals` (unlikely — the ambient file isn't imported anywhere).
