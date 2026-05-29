# /wtf

Record a moment of friction — a place the agent workflow fought you — so it can
be clustered into a fix later. The name is the feeling; the purpose is signal.

## Usage
`/wtf <what just bit you>` — append a friction entry
`/wtf` — prompt for the description, then append

## When to fire it

After implementing a change or running `/verify`, or any time you had to
**deviate from what a skill or doc told you**, or hit a contradiction. Concretely:

- a scaffolder / skill emitted output you had to rewrite (e.g. wrong file type, stale API)
- `CLAUDE.md` said one thing and the code did another
- a documented path/file/flag didn't exist or had moved
- a hook, gate, or check fired as a false positive (or failed to fire when it should have)
- a step in a skill was impossible as written

Each looks different, so deterministic log-parsing misses them — but clustered
together they reveal the stale scaffolder, the contradicting rule, the rotted doc.

## What it does

Appends a structured, dated entry to [`docs/agents/friction-log.md`](../../docs/agents/friction-log.md):

```markdown
### YYYY-MM-DD — <one-line summary>
- **Where:** <skill / doc / file the friction came from>
- **Expected:** <what the skill/doc said or implied>
- **Actual:** <what really happened / what you had to do instead>
- **Deviation:** <the workaround you applied, if any>
```

Use today's date. Keep it to the four lines — it's a signal capture, not a
post-mortem. Do not "fix" anything from `/wtf`; just record.

## Weekly clustering routine

A scheduled sweep turns the raw entries into actionable backlog:

```
Read docs/agents/friction-log.md entries since the last sweep (and recent
session transcripts). Cluster them by root cause (stale skill, contradicting
CLAUDE.md rule, rotted doc, false-positive gate). For each recurring cluster
(>= 2 entries), open ONE GitHub issue describing the root cause and the fix,
and cite the entries. Single one-off entries: list, don't file.
Then deliver the digest (once #280 lands, pipe it to
`scripts/post-digest.sh friction-clustering`).
```

Feed each cluster into `/validate` (which proposes `CLAUDE.md` updates) or the
GC cadence (`docs/agents/gc.md`, proposed in #283) so the recurring ones get
promoted into an ESLint rule / hook / guard test rather than just re-noted. Clear
or archive entries once their cluster has an issue, so the log reflects *open*
friction.
