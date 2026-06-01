#!/usr/bin/env bash
#
# Per-branch preview deploy — runs ON THE HOST, invoked by
# .github/workflows/deploy.yml over SSH. Idempotent per slug: re-running
# redeploys the same stack in place.
#
# The workflow scp's into the stack directory ($--dir) beforehand:
#   - docker-compose.yml   (from the target branch)
#   - .env                 (rendered compose variables, chmod 600)
# and logs the host into ghcr.io (token piped over SSH stdin) so `pull` can
# fetch the private image. Secrets never appear in this script's argv.
#
# Usage: deploy.sh --slug <slug> --dir <stack-dir> [--backup]
set -euo pipefail

SLUG="" DIR="" BACKUP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --backup) BACKUP=1; shift ;;
    *) echo "deploy.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$SLUG" ] || { echo "deploy.sh: --slug is required" >&2; exit 2; }
[ -n "$DIR" ]  || { echo "deploy.sh: --dir is required" >&2; exit 2; }

PROJECT="cm-${SLUG}"
MAX_STACKS="${MAX_STACKS:-6}"

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }

# --- Preflight -------------------------------------------------------------
command -v docker >/dev/null 2>&1 || { echo "docker not found on host" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose v2 is required" >&2; exit 1; }

cd "$DIR"
[ -f docker-compose.yml ] || { echo "missing $DIR/docker-compose.yml" >&2; exit 1; }
[ -f .env ]               || { echo "missing $DIR/.env" >&2; exit 1; }
chmod 600 .env 2>/dev/null || true

# --- Encryption key (per-stack, generated once, mounted as a compose secret) -
# discord.js token encryption needs a stable 32-char key. It lives in a host
# file mounted read-only into the app at /run/secrets/encryption_key (see the
# `secrets:` block in docker-compose.yml) — never in the environment. Generated
# once per stack and reused on every redeploy, so existing encrypted tokens stay
# decryptable. Mode 644 so the in-container non-root user can read the bind mount.
if [ ! -f encryption.key ]; then
  log "Generating encryption key for $PROJECT"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 16 > encryption.key
  else
    head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n' > encryption.key
  fi
fi
chmod 644 encryption.key 2>/dev/null || true

# Explicit -f suppresses auto-loading of any docker-compose.override.yml (the
# dev override that disables Traefik); --env-file feeds per-stack variables.
COMPOSE=(docker compose -p "$PROJECT" -f docker-compose.yml --env-file .env)

stack_exists() {
  docker compose ls --all --format '{{.Name}}' 2>/dev/null | grep -qx "$PROJECT"
}

# --- Stack cap (only blocks brand-new stacks; redeploys always proceed) ----
if ! stack_exists; then
  count="$(docker compose ls --all --format '{{.Name}}' 2>/dev/null | grep -c '^cm-' || true)"
  if [ "${count:-0}" -ge "$MAX_STACKS" ]; then
    echo "Refusing to create a new stack: ${count}/${MAX_STACKS} preview stacks already exist." >&2
    echo "Tear one down (teardown.yml) or raise MAX_STACKS." >&2
    exit 1
  fi
fi

# --- Back up the existing DB before changing anything ----------------------
# mongodump runs inside the mongo container, so the root credentials stay in
# the container's own env and never touch this host shell.
if [ "$BACKUP" -eq 1 ]; then
  if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx mongo; then
    log "Backing up MongoDB for $PROJECT"
    ts="$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -p backups
    if "${COMPOSE[@]}" exec -T mongo sh -c \
      'mongodump --quiet --authenticationDatabase admin -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --db community-manager --archive --gzip' \
      > "backups/${ts}.archive.gz"; then
      echo "  wrote backups/${ts}.archive.gz"
      # Retain the 10 most recent archives for this stack.
      ls -1t backups/*.archive.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
    else
      echo "  mongodump failed — aborting before deploy" >&2
      exit 1
    fi
  else
    log "No running mongo for $PROJECT yet — first deploy, nothing to back up"
  fi
fi

# --- Pull + deploy ---------------------------------------------------------
log "Pulling image for $PROJECT"
"${COMPOSE[@]}" pull

log "Starting $PROJECT"
"${COMPOSE[@]}" up -d --remove-orphans

# --- Wait for health -------------------------------------------------------
log "Waiting for $PROJECT app to become healthy"
cid="$("${COMPOSE[@]}" ps -q app)"
[ -n "$cid" ] || { echo "app container not found after 'up'" >&2; exit 1; }
deadline=$(( SECONDS + 150 ))
while :; do
  status="$(docker inspect -f '{{ if .State.Health }}{{ .State.Health.Status }}{{ else }}{{ .State.Status }}{{ end }}' "$cid" 2>/dev/null || echo unknown)"
  case "$status" in
    healthy) echo "  app is healthy"; break ;;
    unhealthy)
      echo "  app reported unhealthy" >&2
      "${COMPOSE[@]}" logs --tail 60 app >&2 || true
      exit 1 ;;
  esac
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "  app did not become healthy within 150s (last: $status)" >&2
    "${COMPOSE[@]}" logs --tail 60 app >&2 || true
    exit 1
  fi
  sleep 5
done

# --- Tidy ------------------------------------------------------------------
# Dangling-only: other live stacks share base layers, so never `system prune -a`.
log "Pruning dangling images"
docker image prune -f >/dev/null 2>&1 || true

host="$(sed -n 's/^STACK_HOST=//p' .env | head -1)"
log "Deployed $PROJECT  →  https://${host}"
