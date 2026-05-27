# Routines & background loops

Recurring agent work that doesn't need a human in the loop. Two shapes:

- **`/loop <interval> <prompt>`** — local Claude Code session that re-fires on
  a fixed cadence (minutes / hours). Stops when you close the session. Use
  for short polling tasks while you're working on something else
  (`/loop 5m check CI on PR 250`).
- **`/schedule`** — remote routine that runs on a cron schedule in Claude's
  cloud. Survives without your laptop. Use for daily / weekly bookkeeping.

Both invoke regular slash commands and skills — they're just delivery
mechanisms. Recipes for this repo live below.

## Daily triage routine

Keeps the GitHub Issues inbox at `sentinel-web/community-manager` visible
without anyone having to click into the tracker every morning.

**What it does** — runs `/triage` with the "show me what needs attention"
intake, which produces the three canonical buckets defined in the global
triage skill:

1. **Unlabeled** — never triaged
2. **`needs-triage`** — evaluation in progress
3. **`needs-info` with reporter activity since the last triage notes** —
   needs re-evaluation

Counts and a one-line summary per issue, oldest first. **The routine does
not apply labels, close issues, or post comments on its own** — `/triage`
state transitions stay human-initiated. The routine's job is to surface,
not act.

**Cadence** — daily, weekday mornings. Skip weekends to avoid noise on a
low-traffic repo. Cron runs in the scheduler's timezone (typically UTC),
not yours — confirm the timezone in `/schedule create` and offset the
expression accordingly.

**Prompt to schedule:**

```
Run /triage with: "Show me anything that needs my attention."
Report the three buckets (unlabeled, needs-triage, needs-info with reporter
activity). Counts + one-line per issue, oldest first. Do not edit labels,
close issues, or post comments — surface only.
```

**Output** — read the routine's session transcript from the Claude Code
desktop / web app when you sit down. No notifications wired up yet (see
*Open questions* below).

### Try it locally first

Before scheduling, dry-run once to make sure the output is what you want:

```
/triage
```

Then answer the prompt with "Show me anything that needs my attention". If
the digest looks right, schedule it remotely.

### Schedule it

```
/schedule create
```

Follow the prompts. The skill will ask for cron expression, prompt, and a
descriptive name. Suggested values:

- **Name:** `daily-triage-digest`
- **Cron:** `30 7 * * 1-5` — that's 07:30 Mon–Fri *in the scheduler's
  timezone*; adjust for your local TZ when `/schedule create` shows you
  which one it'll use
- **Prompt:** the prompt block above

Manage existing routines with `/schedule list` and `/schedule update`.

## PR babysitter

Surfaces the state of every open PR a few times a workday — CI status,
mergeability with `main`, reviewer status — so nothing rots in the queue
while you're heads-down on something else.

**What it does** — for each open, non-draft PR at
`sentinel-web/community-manager`:

- CI: pass / fail / pending (which check failed, if known)
- Mergeable: clean / dirty / unknown vs current `main`
- Review: approved / changes requested / waiting >24h on a requested
  reviewer
- A one-line "next action" hint per PR (e.g. *rebase against main*, *ping
  reviewer*, *fix lint*) — **suggestion only**

**What it does not do** — no auto-rebase, no auto-merge, no review
dismissals, no comments on the PRs themselves. Surface only, same
principle as the triage routine. The digest goes to the routine's session
transcript; the human still drives the next action.

**Cadence** — 3× per workday. Suggested: 09:30, 13:30, 17:30 Mon–Fri in
the scheduler's timezone — adjust the cron for your local TZ at
`/schedule create` time. Skip weekends. If the repo is averaging fewer
than 2 open PRs at a time, this is overkill — drop to once a day, or
just eyeball the GitHub UI directly.

**Prompt to schedule:**

```
For sentinel-web/community-manager, list every open non-draft PR. For each:
status check rollup, mergeable state vs main, review decision, age, and
"requested reviewer" wait time. One line per PR with a suggested next
action (rebase / ping reviewer / fix CI / nothing). Do not push, comment,
merge, or dismiss reviews — surface only.

Use: gh pr list --state open --draft=false --json number,title,headRefName,mergeable,statusCheckRollup,reviewDecision,reviewRequests,updatedAt,isDraft
Followed by per-PR enrichment as needed via gh pr checks <n> and gh pr view <n>.
```

### Try it locally first

```
gh pr list --state open --draft=false --json number,title,headRefName,mergeable,statusCheckRollup,reviewDecision,reviewRequests,updatedAt
```

Eyeball the JSON. If the fields cover what you want to see in a digest,
schedule it. If not, add fields to the query before scheduling — the
routine should not paper over a missing field by guessing.

### Schedule it

```
/schedule create
```

Suggested values:

- **Name:** `pr-babysitter-digest`
- **Cron:** `30 9,13,17 * * 1-5` — 09:30 / 13:30 / 17:30 Mon–Fri *in the
  scheduler's timezone*; offset for your local TZ when `/schedule create`
  shows you which one it'll use
- **Prompt:** the prompt block above

## Docs-drift check

Catches the lag between code and the three reference docs the agent flow
relies on. The repo's `/validate` skill checks staged changes on demand;
this routine runs the same idea over the entire repo on a weekly cadence
so drift doesn't accumulate silently between commits.

**What it does** — cross-checks three code/doc pairs and reports
mismatches:

| Code | Doc | Expected invariant |
|------|-----|--------------------|
| `imports/api/collections/*.collection.ts` | `docs/collections.md` | Every collection is documented with its field-level schema |
| `imports/ui/**/*Form.tsx` + the `navigationValue` dispatch in `imports/ui/main/Main.tsx` | `docs/views-and-forms.md` | Every drawer form and every navigable view appears in the index |
| new `server/apis/*.server.ts` files | `CLAUDE.md` ("Directory Structure" + "Adding New Collections") | New APIs are mentioned where the doc lists APIs / wiring steps |

For each pair, output: collections / views / APIs present in code but
missing from docs, present in docs but no longer in code, and any name /
path mismatches. Reference each finding with the offending code path and
the doc line that would need to change.

**What it does not do** — no auto-edits to docs, no PR creation. Drift
fixes are still human-driven, typically through a focused `/validate`
follow-up on a branch. The routine produces a punch list, not a patch.

**Cadence** — weekly, Monday morning. Repo-wide doc drift moves on the
timescale of merged PRs, not hours.

**Prompt to schedule:**

```
For sentinel-web/community-manager, run a docs-drift check across these
pairs:

1. imports/api/collections/*.collection.ts vs docs/collections.md
2. imports/ui/**/*Form.tsx + the navigationValue switch in
   imports/ui/main/Main.tsx vs docs/views-and-forms.md
3. server/apis/*.server.ts vs the API directory list and "Adding New
   Collections" steps in CLAUDE.md

For each pair, report: (a) present in code, missing from doc, (b)
present in doc, missing from code, (c) name or path mismatches. Cite
the code path and the doc line. Do not edit any files — punch list only.
```

### Try it locally first

Before scheduling, do a one-off run against the current main to see what
the punch list looks like:

```
/validate
```

`/validate` today only reads staged changes; for a full repo scan, run
the docs-drift prompt above as a regular Claude Code message. If the
output is the right shape, schedule it.

### Schedule it

```
/schedule create
```

Suggested values:

- **Name:** `weekly-docs-drift`
- **Cron:** `0 8 * * 1` (08:00 every Monday in the scheduler's timezone —
  offset for your local TZ at `/schedule create` time)
- **Prompt:** the prompt block above

## Future candidates

Other bookkeeping that could move to a routine once volume justifies it.
Not built yet — order is rough priority.

### Dependency hygiene

Weekly `npm audit` + `npm outdated`, comment on a single rolling tracking
issue when something new shows up. The repo already has `npm run update`
as the human-initiated counterpart.

## Open questions

- **Where does the digest land?** Today the routine's transcript lives in
  the Claude Code session list. Options for active delivery (email, Slack,
  GitHub issue comment) need a connector that isn't wired up yet — pick
  one before the routine becomes load-bearing.
- **Quota / cost** — remote routines burn tokens on a schedule. Re-evaluate
  the cadence once we see real usage. Daily is a sane starting point;
  hourly is almost certainly too much for this repo's traffic.
