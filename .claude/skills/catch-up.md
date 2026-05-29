# /catch-up

Comprehend the codebase's *current* conventions from live code before writing
any — so generated code matches today's patterns, not a frozen template or a
stale memory note. Run it before `/collection`, `/component`, `/form`,
`/section`, or any non-trivial change in an unfamiliar area.

## Usage
`/catch-up <area>` — read the canonical examples for an area before working in it
`/catch-up` — infer the area from the current task / branch

## Why

Conventions drift faster than docs and memory (the scaffolders had gone stale to
`.js` + PropTypes before #277). The cheapest defence is to read a *real, current*
example next to the thing you're about to create and mirror it — comprehend
first, code later.

## What to read, by area

Read the live source (not a template) for the area in play:

| Area | Read these current examples |
|------|------------------------------|
| New collection | `imports/api/types/crud.ts` (`CrudCollectionMap`), `server/collection-registry.ts`, the `COLLECTIONS` map in `server/crud.lib.ts`, the `collectionNames` array in `server/main.ts`, and an existing `imports/api/collections/*.collection.ts` |
| Component | a recent `imports/ui/**/*.tsx` (props `interface` above, no `React.FC`/PropTypes) |
| Drawer form | `imports/ui/hooks/useEntityForm.ts` + a real `*Form.tsx` (e.g. `imports/ui/squads/SquadsForm.tsx`) |
| Section page | `imports/ui/section/types.ts` + `imports/ui/squads/Squads.tsx` + `imports/ui/squads/squads.columns.tsx` |
| Server method | `server/mutation-pipeline.ts` + a recent `server/apis/*.server.ts` |
| Permissions / FK / audit | `server/collection-registry.ts` (and, once #289 lands, each entry's `aiContext` hint) + `server/main.ts` `checkPermission` |

Also skim `CLAUDE.md` and the relevant `CONTEXT.md` glossary entry, but trust the
**code** where they disagree — then record the divergence (via the `/wtf` friction
channel proposed in #282, or just note it) so the doc gets fixed.

## How to use what you read

- Mirror the newest sibling's structure, imports, and naming exactly.
- Confirm the registration/wiring steps against the *current* files (e.g. a new
  collection touches four places + the registry — verify each still exists where
  the scaffolder says).
- Note any divergence between what a skill/doc told you and what the code shows;
  capture it (the `/wtf` friction channel proposed in #282 is where these get
  clustered and fixed).

This skill reads only — it never edits. Its output is a short "here's how this
area is done today" brief you then implement against.
