# /review

Review staged or changed files against the coding guidelines, as **independent
persona passes** rather than one undifferentiated read — and stop hard when a
change touches the load-bearing security invariants.

## Usage
`/review` - Review all uncommitted changes
`/review staged` - Review only staged changes
`/review <file>` - Review a specific file

## Why personas

A single reviewer pass blurs concerns and rubber-stamps. A single maintainer also
can't supply multiple human reviewers. So `/review` runs the diff through three
**fresh-context sub-agents** (the `Agent`/Task tool), one per concern, in the
repo's priority order **Security > Performance > Correctness**. Each is **read-only**
— give them Read/Grep/Glob and read-only `git`, never Edit/Write — so a reviewer
can never "fix and pass" its own finding.

### 1. Security pass
- Every new/changed Meteor method routes through `runMutation` (or explicitly
  justifies why not) and has a `COLLECTION_REGISTRY` entry.
- `this.userId` checked; `checkPermission(userId, module, op)` enforced before the operation.
- Mutations emit an audit log (`createLog` / the pipeline's audit step).
- Inputs validated with the `validate*` helpers; no `assertSafeSelector` bypass.
- No `services`/password-hash leakage; rich-text written through the sanitizer.
- `Meteor.Error(code, message)` (not generic `Error`); no stack traces to the client.

### 2. Performance pass
- Subscriptions filtered + limited; queries use indexes/`$in`, not N+1 loops.
- `useCallback`/`useMemo` with **narrowed** dependency arrays (specific fields, not whole objects).
- No `useEffect` used for derived state (use `useMemo`).
- No unnecessary re-renders / unstable inline literals in deps.

### 3. Correctness pass
- Handles both create (no `_id`) and update (has `_id`) paths.
- `valuePropName="checked"` on Switch/Checkbox `Form.Item`s.
- Nullable wire fields mirror `string | null`; `?? undefined` only at the antd DOM boundary.
- Color render preserved (`color || 'transparent'`).
- Function components only — **no `React.FC`, no PropTypes** (also lint-enforced).
- `!` (not `?.`) on `member.profile.X`.

## Judgment gate — never auto-approve these

Mechanical findings (formatting, naming, narrow deps) the personas can clear on
their own. But if the diff touches any of the **load-bearing security
invariants**, the review MUST emit a blocking **HUMAN JUDGMENT REQUIRED** section
and withhold an auto-merge recommendation until a human signs off:

- `server/collection-registry.ts` — permission/FK/audit metadata
- `checkPermission` / the CRUD-module list / role logic in `server/main.ts`
- `server/mutation-pipeline.ts` — the shared auth→perm→validate→audit lifecycle
- `imports/api/htmlSanitizer/sanitizePolicy.ts` — the sanitizer allow-list
- any foreign-key change in an `imports/api/collections/*.collection.ts` or its registry entry

These are exactly the categories where a wrong "looks fine" is a security
regression, so they are out of scope for an autonomous pass.

## Output format

```
## Code Review: <files reviewed>

### 🔒 Security   — <PASS / FINDINGS>
- <finding: file:line — issue — fix>

### ⚡ Performance — <PASS / FINDINGS>
- ...

### ✅ Correctness — <PASS / FINDINGS>
- ...

### ⚖️ HUMAN JUDGMENT REQUIRED   (only if a gate path was touched)
- <path> — <what changed> — <why a human must confirm>

### Summary
<Critical / Improvements / Minor>, and an explicit merge recommendation:
auto-mergeable | needs-fixes | needs-human-judgment
```

## Wiring into CI (optional follow-up)

To make autonomous/AFK PRs always get reviewed, this can run as a GitHub Action
(an agent step on `pull_request`) that posts the persona summary and, when a gate
path is in the diff, applies a blocking `needs-human-judgment` label. That needs
an agent-in-CI runner + careful handling of untrusted PR text (never interpolate
PR/issue fields into shell — see GitHub's workflow-injection guidance), so it is
left as a separate change; the skill above is usable interactively today.
