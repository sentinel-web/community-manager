# Prompt-cache hygiene

Anthropic's prompt cache keys on the **longest stable prefix** of the context.
Anything that changes invalidates the cache from that point on, so the cost-saving
rule is simple: **stable content first, volatile content last.** This matters here
because the loops are cold-boot-heavy (Meteor rebuilds, multi-minute `/verify` and
e2e cycles) and re-read large, mostly-unchanging context each turn.

## Order context stable → volatile

When assembling context for a task (a prompt, a sub-agent brief, a routine), put
the parts in decreasing order of stability:

1. **Architecture & invariants** — `CLAUDE.md`, the `runMutation` pipeline, the
   `COLLECTION_REGISTRY` rules, the domain glossary in `CONTEXT.md`. These barely
   change between turns → cache them at the front.
2. **Skill / task instructions** — the relevant `.claude/skills/*.md`. Stable
   within a task.
3. **The working set** — the files being changed this turn.
4. **Volatile last** — today's date, current branch, `git status`, CI run IDs,
   timestamps, anything regenerated every turn. Putting these up front would bust
   the cache for everything after them.

## Practical cues

- Don't interpolate the date / branch / a timestamp into the *front* of a
  long-lived prompt or a `CLAUDE.md`-style preamble; append them at the end.
- Quote large stable references (architecture docs, registry) verbatim and in a
  fixed order so the prefix is byte-identical across turns.
- In routines (`routines.md`), keep the fixed instruction block stable and let
  only the queried data vary — the instruction prefix then stays cached across runs.

## Scope

This is a cost/latency optimization, not correctness — but on a repo whose agent
loops re-read a lot of unchanging context behind a slow backend, prefix-stable
ordering is close to free and compounds across every cached turn.
