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

**Cadence** — daily, weekday mornings (e.g. 07:30 in your local TZ). Skip
weekends to avoid noise on a low-traffic repo.

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
- **Cron:** `30 7 * * 1-5` (07:30 Mon–Fri)
- **Prompt:** the prompt block above

Manage existing routines with `/schedule list` and `/schedule update`.

## Dependency hygiene

Catches new npm vulnerabilities and creeping package drift so the manual
`npm run update` runs don't bring back a year's worth of changes at
once. CLAUDE.md lists `npm run update` as the human counterpart — this
routine surfaces *what* would change so the human knows *when* to run
it.

**What it does** — once a week, against `main`:

- Run `npm audit --json` and report new findings since last run
  (severity, package, fix availability, whether `npm audit fix` would
  resolve without a major bump)
- Run `npm outdated --json` and report packages that crossed a minor or
  major boundary since last run
- Flag the Meteor-pinned packages separately — those can't be bumped
  without a Meteor compatibility check (see CLAUDE.md → Deployment for
  the Node 22 / Meteor 3.4+ baseline)
- Suggest a triage: *patch / minor*, *major (needs review)*, *Meteor
  pinned (skip)*

**What it does not do** — no `npm install`, no `npm audit fix`, no
package.json edits, no PR creation. The routine produces a digest; the
human decides what to bump and runs `npm run update` (or targeted
`npm install <pkg>@<version>`) on a focused branch.

**Cadence** — weekly, Monday morning. Pair with the docs-drift check so
both weekly digests land at the same sitting — schedule it an hour after
docs-drift to avoid concurrent runs.

**Prompt to schedule:**

```
For sentinel-web/community-manager on the main branch, run:

1. npm audit --json — list new findings since last run. Per finding:
   severity, package, fix availability (yes / yes-major / no), whether
   it's a direct dep or transitive.
2. npm outdated --json — list packages crossing a minor or major
   boundary since last run. Flag Meteor-pinned packages separately.

Bucket the output: (a) patch / minor — safe to bump, (b) major — needs
review, (c) Meteor pinned — skip, see CLAUDE.md → Deployment. Do not
run npm install, npm audit fix, or edit package.json — surface only.
```

### Try it locally first

Dry-run both data sources before scheduling. The `jq` filter just makes
the audit output easier to skim — drop it if `jq` isn't installed and
read the raw JSON instead, or run `npm audit` without `--json` for the
default human-readable view.

```
npm audit --json | jq '{vulnerabilities: .metadata.vulnerabilities, findings: [.vulnerabilities | to_entries[] | {pkg: .key, severity: .value.severity, fixAvailable: .value.fixAvailable}]}'
npm outdated --json
```

Eyeball the JSON. If it covers the fields you'd want bucketed in the
weekly digest, schedule it. If you'd rather see specific extras (e.g.
`peerDependencies` conflicts), add them to the prompt before scheduling.

### Schedule it

```
/schedule create
```

Suggested values:

- **Name:** `weekly-dependency-hygiene`
- **Cron:** `0 9 * * 1` (09:00 every Monday — one hour after the
  docs-drift check, so both weekly digests are ready together)
- **Prompt:** the prompt block above

## Future candidates

Other bookkeeping that could move to a routine once volume justifies it.
Not built yet — order is rough priority.

### PR babysitter

Scan open PRs for: red CI, merge conflicts with `main`, reviewer-requested
changes sitting more than 24h. One-line status per PR. **No auto-rebase,
no auto-merge** — same surface-only principle as triage. Useful once PR
volume is consistently >2/day; for now, eyeballing the GitHub UI is
faster.

Sketch prompt: `gh pr list --state open --json number,title,headRefName,mergeable,statusCheckRollup,reviewDecision` plus a per-PR summary.

### Docs-drift check

Weekly diff between code and docs:

- `imports/api/collections/*.collection.ts` vs `docs/collections.md`
- `imports/ui/**/*Form.tsx` + nav switch vs `docs/views-and-forms.md`
- new `*.server.ts` files vs the API list in `CLAUDE.md`

A natural background extension of `/validate` (which today only runs on
demand against staged changes).

## Open questions

- **Where does the digest land?** Today the routine's transcript lives in
  the Claude Code session list. Options for active delivery (email, Slack,
  GitHub issue comment) need a connector that isn't wired up yet — pick
  one before the routine becomes load-bearing.
- **Quota / cost** — remote routines burn tokens on a schedule. Re-evaluate
  the cadence once we see real usage. Daily is a sane starting point;
  hourly is almost certainly too much for this repo's traffic.
