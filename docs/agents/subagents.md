# Sub-agent conventions

When a task spawns sub-agents (the `Agent`/Task tool) — for review, research, or
fan-out — two repo-specific rules keep them safe and effective.

## 1. Reviewers and researchers get read-only tools

A sub-agent whose job is to *judge* or *gather* must not also be able to *change*
the thing it's judging. Give review and research sub-agents only **Read, Grep,
Glob** (and read-only `git`) — never **Edit / Write / Bash-that-mutates**:

- A reviewer that can edit will "fix and pass" its own finding, defeating the
  point of an independent pass (this is why `/review`'s persona passes are
  read-only — see `.claude/skills/review.md`).
- A research/scout sub-agent only needs to read and report; write access is
  attack surface and a footgun, nothing more.

Reserve Edit/Write for sub-agents explicitly tasked with *implementing*, ideally
in their own worktree (`docs/agents/worktrees.md`).

## 2. Sub-agents don't inherit project skills

A spawned sub-agent starts fresh — it does **not** automatically have this repo's
`.claude/skills/`. If a sub-agent needs a project skill, **name the file and the
relevant rules in its prompt**. Common cases:

- A sub-agent validating a change should be pointed at `/validate`
  (`.claude/skills/validate.md`) and the CLAUDE.md conventions it enforces.
- A sub-agent reasoning about access control should be given `/permissions`
  (`.claude/skills/permissions.md`) and the `COLLECTION_REGISTRY` rules.
- A sub-agent doing feature verification should get the relevant
  `.claude/skills/verify.md` criteria (or a `verify-contract.md`), not be expected
  to "know the golden paths."

Don't assume inheritance — quote or reference what the sub-agent must follow,
and keep that reference near the front of its prompt (see
`docs/agents/prompt-cache.md`).

## Quick checklist when spawning a sub-agent

- [ ] Is it judging/gathering? → Read/Grep/Glob only, no Edit/Write.
- [ ] Does it need a project skill or convention? → name the file + rules in the prompt.
- [ ] Is it implementing in parallel? → give it an isolated worktree.
