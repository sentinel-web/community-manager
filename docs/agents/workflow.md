# Development Workflow

The end-to-end flow for taking a change from issue to merged PR. Most steps map
to a Claude Code skill in `.claude/skills/` (e.g. `/issue`, `/plan`, `/branch`,
`/test`, `/review`, `/validate`, `/pr`).

1. **GitHub Issue** - Start from a GitHub issue describing the feature/bug
2. **Create Implementation Plan** - Analyze requirements and design approach
3. **Ask Questions** - Clarify ambiguities with stakeholders
4. **Refine Plan** - Update plan based on feedback
5. **Document Plan in Issue** - Add implementation details to the GitHub issue
6. **Create Branch** - Create feature branch from issue (e.g., `feature/issue-123-description`)
7. **Implement Changes** - Write code following coding guidelines
8. **Run Tests** - Execute `npm test` and verify all pass
9. **Fix Issues** - Address any failing tests or bugs
10. **Run Code Review** - Self-review or request peer review
11. **Fix Review Issues** - Address feedback from review
12. **Validate Against CLAUDE.md** - Ensure code follows documented patterns; update CLAUDE.md if new patterns emerge
13. **Create Pull Request** - Include summary of changes and steps for testing/reproduction
