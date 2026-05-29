# Friction log

Raw, dated entries recording where the agent workflow fought a contributor —
appended by the [`/wtf`](../../.claude/skills/wtf.md) skill. Each entry is signal,
not a fix. A weekly clustering routine (see `/wtf`) groups recurring entries into
GitHub issues and feeds them to `/validate` and the GC cadence
([`gc.md`](gc.md)) for promotion into an enforced rule.

Entry format:

```markdown
### YYYY-MM-DD — <one-line summary>
- **Where:** <skill / doc / file>
- **Expected:** <what the skill/doc said or implied>
- **Actual:** <what really happened>
- **Deviation:** <the workaround applied, if any>
```

Archive an entry once its cluster has an issue, so this file reflects *open*
friction. Keep newest at the top.

---

<!-- /wtf appends new entries below this line -->
