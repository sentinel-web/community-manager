# Pre-CI invariant critic

A 60-second self-review run **before** paying for the slow Meteor cold boot
(`/verify`, `npm test`, e2e). It catches the repeated, mechanical invariant
breaks that would otherwise fail CI minutes later — a cheap rubber-duck pass over
the diff, not a substitute for `/review` or the test suite.

Run it after `/implement`, before `/commit`:

```bash
git diff --staged --name-only   # what changed
```

Then walk the diff against this checklist and fix anything obvious before
spending a CI cycle:

## Server mutations
- [ ] New/changed method routes through `runMutation` (or documents why not).
- [ ] New collection is wired in **all** required places — `CrudCollectionMap`
      (`imports/api/types/crud.ts`), `COLLECTIONS` (`server/crud.lib.ts`),
      `collectionNames` (`server/main.ts`), and a `COLLECTION_REGISTRY` entry —
      and the alphabetical ordering is preserved in each.
- [ ] Mutation emits an audit log; inputs validated with the `validate*` helpers.
- [ ] `*Async` collection methods used (no sync `find`/`insert`/`update`/`remove`).

## Client
- [ ] No `React.FC` / PropTypes; props are a typed `interface` above the component.
- [ ] `valuePropName="checked"` on Switch/Checkbox `Form.Item`s.
- [ ] `!` (not `?.`) on `member.profile.X`; color render uses `color || 'transparent'`.
- [ ] `useFind` has a `useSubscribe`; hook dependency arrays are narrowed.

## Rich text / sanitizer
- [ ] Any new rich-text surface goes through the sanitizer allow-list
      (`imports/api/htmlSanitizer/sanitizePolicy.ts`); only `event.description`
      and briefing-template `content` are rich text.

## Cheap gates first
- [ ] `npm run typecheck` and `npm run lint` (both pure-Node, seconds) pass
      **before** booting Meteor for `npm test` / `/verify`.

This is intentionally a *prose* checklist, not a tool — most items are also
enforced mechanically by the lint rules (#276), the hooks (#275), and `/review`
(#281). It exists to front-load the cheap checks so the expensive ones run on
already-clean code.
