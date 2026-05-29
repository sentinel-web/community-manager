#!/usr/bin/env bash
#
# Deliver a scheduled routine's digest to GitHub instead of leaving it to die in
# the session transcript (docs/agents/routines.md "Open questions"). It upserts a
# single dedicated digest issue per routine — idempotent, so re-runs append to the
# same issue rather than spamming new ones — and ONLY when the digest is non-empty.
# An empty digest stays silent, so the maintainer is notified (via GitHub's own
# issue notifications) only on an actionable transition.
#
# Safety: this is READ-ONLY with respect to every OTHER issue and PR. It never
# labels, closes, comments on, or merges anything except its own `[routine] <name>`
# digest issue. Routines ingest untrusted issue/PR text (lethal trifecta), so they
# must never act on arbitrary objects — surfacing is the whole job.
#
# Usage: <command that prints the digest> | scripts/post-digest.sh <routine-name> [--dry-run]
#   gh pr list ... | format ... | scripts/post-digest.sh pr-babysitter

set -euo pipefail

REPO="sentinel-web/community-manager"
LABEL="routine-digest"

NAME="${1:?usage: post-digest.sh <routine-name> [--dry-run]}"
MODE="${2:-}"
BODY=$(cat)

# Empty / whitespace-only digest => nothing actionable => stay silent.
if ! printf '%s' "$BODY" | grep -q '[^[:space:]]'; then
  echo "post-digest: digest for '$NAME' is empty — nothing to deliver." >&2
  exit 0
fi

TITLE="[routine] ${NAME}"
FOOTER="— delivered by scripts/post-digest.sh ($NAME)"

if [ "$MODE" = "--dry-run" ]; then
  echo "[dry-run] would upsert issue titled '$TITLE' (label '$LABEL') with body:"
  printf '%s\n%s\n' "$BODY" "$FOOTER"
  exit 0
fi

# Ensure the digest label exists (idempotent).
gh label create "$LABEL" --repo "$REPO" --color BFD4F2 --description "Automated routine digest (post-digest.sh)" >/dev/null 2>&1 || true

# Find an existing open digest issue for this routine (exact title match).
NUM=$(gh issue list --repo "$REPO" --state open --label "$LABEL" --json number,title \
        -q "map(select(.title == \"$TITLE\")) | .[0].number // empty")

if [ -n "$NUM" ]; then
  gh issue comment "$NUM" --repo "$REPO" --body "$(printf '%s\n\n%s' "$BODY" "$FOOTER")"
  echo "post-digest: appended digest to issue #$NUM"
else
  gh issue create --repo "$REPO" --title "$TITLE" --label "$LABEL" \
    --body "$(printf '%s\n\n%s' "$BODY" "$FOOTER")"
fi
