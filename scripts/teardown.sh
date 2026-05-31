#!/usr/bin/env bash
#
# Tear down a preview stack — runs ON THE HOST, invoked by
# .github/workflows/teardown.yml. mongodump backups under <dir>/backups are
# always preserved.
#
# Usage:
#   teardown.sh --slug <slug> --dir <stack-dir> [--purge]   # stop a stack
#   teardown.sh --list                                       # list cm-* stacks
#
# --purge also removes the stack's volumes (its MongoDB data). The workflow
# passes it on branch-delete (data is disposable then) but not on a manual
# teardown (so the stack can be redeployed with its data intact).
set -euo pipefail

SLUG="" DIR="" PURGE=0 LIST=0
while [ $# -gt 0 ]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --purge) PURGE=1; shift ;;
    --list) LIST=1; shift ;;
    *) echo "teardown.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

docker compose version >/dev/null 2>&1 || { echo "docker compose v2 is required" >&2; exit 1; }

if [ "$LIST" -eq 1 ]; then
  echo "Active preview stacks:"
  docker compose ls --all --format '{{.Name}}\t{{.Status}}' 2>/dev/null | grep '^cm-' || echo "  (none)"
  exit 0
fi

[ -n "$SLUG" ] || { echo "teardown.sh: --slug is required" >&2; exit 2; }
PROJECT="cm-${SLUG}"

down=(down --remove-orphans)
[ "$PURGE" -eq 1 ] && down+=(--volumes)

# Prefer the stack's own compose file + env if still present; otherwise tear
# down by project name alone (Compose matches running resources by label).
if [ -n "$DIR" ] && [ -f "$DIR/docker-compose.yml" ]; then
  cd "$DIR"
  if [ -f .env ]; then
    docker compose -p "$PROJECT" -f docker-compose.yml --env-file .env "${down[@]}"
  else
    docker compose -p "$PROJECT" -f docker-compose.yml "${down[@]}"
  fi
else
  docker compose -p "$PROJECT" "${down[@]}"
fi

echo "Tore down $PROJECT (volumes purged: ${PURGE}). Backups under the stack dir are kept."
