#!/usr/bin/env bash
# Shared slug derivation — the single source of truth for turning a git branch
# name into a DNS-label-safe stack identity. Sourced by the `resolve` step of
# both .github/workflows/deploy.yml and teardown.yml so the project name,
# Traefik router name, subdomain and ROOT_URL are always derived identically.
#
# Rules: lowercase → non-[a-z0-9] runs collapse to '-' → strip leading/trailing
# '-' → truncate to 40 chars (leaves room under the 63-char DNS label limit once
# the base domain is appended) → re-strip any trailing '-' left by truncation.
# If the result is empty (pathological branch name), fall back to the 2nd arg.

# slugify <branch-name> [fallback] -> prints the slug
slugify() {
  local input="$1" fallback="${2:-stack}" slug
  slug="$(printf '%s' "$input" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-40 \
    | sed -E 's/-+$//')"
  [ -n "$slug" ] || slug="$fallback"
  printf '%s' "$slug"
}
