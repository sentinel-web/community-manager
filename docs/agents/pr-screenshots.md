# Visual evidence on UI PRs

For any PR that changes a navigable view, attach before/after screenshots so the
reviewer (human or `/review` persona) sees the actual visual result, not just the
diff. The repo already has the capture tool — this is the convention for using it.

## Tool

`scripts/capture-views.mjs` logs in via the real login form and screenshots every
navigable view (per `docs/views-and-forms.md`) at desktop + mobile widths into
`/tmp/cm-shots/<viewport>/NN-<view>.png`.

## Workflow

Reset to known data first so before/after differ only by the change, not by
seed drift:

```bash
# 1. with the dev server up and BEFORE applying the change (base commit),
#    reset state then capture:
#    (call demoData.generate via the app, then)
node scripts/capture-views.mjs              # -> /tmp/cm-shots (rename to .../before)

# 2. apply the change, reset to the same state, capture again:
node scripts/capture-views.mjs              # -> /tmp/cm-shots (rename to .../after)
```

Always capture against a `demoData.generate` reset (CLAUDE.md → Demo Data) so the
seed is identical on both sides — otherwise visual diffs are dominated by random
data, not the change.

## Attaching to the PR

GitHub needs images hosted to render them in a PR. Two ways:

- **Web (simplest):** drag the relevant `before`/`after` PNGs into the PR
  description on github.com — GitHub uploads and inlines them.
- **CLI:** upload as a release/asset or gist and reference the URLs in the PR body
  via `gh pr edit <n> --body-file`. (Plain `gh` can't inline a local file into a
  PR body.)

Attach **only the changed views**, side by side, not the whole set — the point is
focused evidence. Note in the PR which views are shown and at which viewport.

This is surfaced evidence, not a gate; a pixel-diff CI job could come later, but
the manual before/after covers the common case at zero infra cost.
