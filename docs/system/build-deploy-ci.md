# Build, Configuration, Deployment & CI/CD

How the app is configured at runtime, compiled into a Docker image, shipped to a single Traefik host, and gated by GitHub Actions. This is the operational seam between source and a running stack.

## Key files

| Path | Role |
|------|------|
| `package.json` | npm scripts (`start`/`test`/`test-app`/`update`/`visualize`/`typecheck`/`lint`/`e2e`); `engines.node` pinned to `22.x`; Meteor main/test modules |
| `.meteor/release` | Single source of truth for the Meteor version (`METEOR@3.4.1`); CI keys its Meteor cache on this file |
| `rspack.config.js` | Rspack bundler config via `@meteorjs/rspack` (returns `{}` — defaults only; flags via `Meteor.is*`) |
| `tsconfig.json` | `strict: true`, `noEmit`, `bundler` resolution; `meteor/*` resolved to `.meteor/local/types/packages.d.ts` |
| `Dockerfile` | Two-stage build: `geoffreybooth/meteor-base:3.4` builder → `node:22-slim` runtime; tini, non-root `meteor` user, healthcheck |
| `docker-compose.yml` | Production/preview stack: `app` + `mongo:7.0`, Traefik labels, hardening (read-only, cap_drop, no-new-privileges) |
| `docker-compose.override.yml` | Dev-only override: publishes `3000:3000`, disables Traefik, `ROOT_URL` default |
| `server/config.ts` | Server settings (`RATE_LIMITS`, `CACHE`, `SQUAD_SCOPED_PERMISSIONS`, `TELEMETRY`, `LOGS`) with `Meteor.settings` overrides via lazy getters |
| `settings.example.json` | Example `Meteor.settings` JSON (`bootstrapAdmin`, rate limits, cache TTL) |
| `.env.example` | Compose env-var contract (domain/Traefik, per-branch stack vars, Mongo creds, `METEOR_SETTINGS`) |
| `.github/workflows/ci.yml` | PR/push gate: parallel `typecheck`, `lint`, `mocha + e2e` jobs |
| `.github/workflows/build-publish.yml` | Reusable workflow: build image → GHCR push → Trivy scan → SBOM/provenance attest |
| `.github/workflows/deploy.yml` | Per-branch preview deploy (build + SSH to host) |
| `.github/workflows/release.yml` | `v*` tag → versioned + `latest` image + GitHub Release (does **not** deploy) |
| `.github/workflows/teardown.yml` | Manual / branch-delete teardown of a preview stack |
| `.github/dependabot.yml` | Grouped weekly updates for npm / actions / docker; majors and Node ignored |
| `.github/release.yml` | Release-note categorisation by PR label for `gh release create --generate-notes` |
| `scripts/lib-slug.sh` | `slugify()` — branch name → DNS-label-safe stack identity (shared by deploy + teardown) |
| `scripts/deploy.sh` | Runs **on the host**: stack cap → mongodump backup → pull → `compose up` → wait for health |
| `scripts/teardown.sh` | Runs **on the host**: `compose down` (optionally `--volumes`); `--list` lists `cm-*` stacks |
| `scripts/check-branch.sh` | Pre-commit guard: hard-stop if the working tree drifted onto the wrong branch |
| `.dockerignore` / `.trivyignore` / `.meteorignore` | Build-context excludes / Trivy CVE allowlist (empty) / Meteor HMR excludes for `e2e/` |

## How it works

### Configuration layers

There are three distinct configuration channels; they do not overlap:

| Channel | Source | Consumed by | Examples |
|---------|--------|-------------|----------|
| OS env vars | container `environment:` / `.env` | Meteor core + `process.env` | `ROOT_URL`, `MONGO_URL`, `PORT`, `NODE_ENV` |
| `Meteor.settings` | `METEOR_SETTINGS` env JSON / `settings.json` | `server/config.ts`, bootstrap admin | `bootstrapAdmin`, `rateLimits`, `cache`, `telemetry`, `logs` |
| UI constants | `imports/config.ts` (compiled in) | client React | breakpoints, layout ratios |

`server/config.ts` is the typed accessor for the second channel. `getConfig(path, default)` (`server/config.ts:64`) walks `Meteor.settings` first via `getNestedValue`, then falls back to the in-file `DEFAULTS` object, then to the caller's literal default. Every exported config object (`RATE_LIMITS`, `CACHE`, `SQUAD_SCOPED_PERMISSIONS`, `TELEMETRY`, `LOGS`) exposes **getters**, not values — so a setting read is always live against `Meteor.settings`, never frozen at import time.

| Export | Setting path | Default | Effect |
|--------|--------------|---------|--------|
| `RATE_LIMITS.backup.{create,restore,createQuick}` | `rateLimits.backup.*` | 5/min, 2/min, 5/min | Backup method rate-limit buckets |
| `CACHE.roleTtlMs` | `cache.roleTtlMs` | `60000` | Role-cache TTL (see permissions-rbac) |
| `SQUAD_SCOPED_PERMISSIONS.enabled` | `squadScopedPermissions` | `true` | Squad-scope filter toggle |
| `TELEMETRY.{enabled,otlpEndpoint}` | `telemetry.*` | `true`, `''` | OTLP exporter (empty endpoint → console exporter) |
| `LOGS.retentionSeconds` | `logs.retentionSeconds` | `90d` | Drives the audit-log TTL index; `0` disables expiry |

### Build pipeline (Dockerfile)

```
geoffreybooth/meteor-base:3.4 (builder)
  └─ meteor npm ci --include=dev          # rspack lives in devDependencies
  └─ meteor build --server-only --directory /built-app
node:22-slim (production)
  └─ COPY /built-app/bundle ./
  └─ (programs/server) npm install --omit=dev   # no lockfile in the bundle → npm ci impossible
  └─ tini → node main.js   (USER meteor, EXPOSE 3000, HEALTHCHECK GET /)
```

Two non-obvious build facts, both with inline Dockerfile comments:

- **`--include=dev` is mandatory** (`Dockerfile:16`). The meteor-base image sets `NODE_ENV=production`, which makes npm treat installs as `--omit=dev`. The rspack bundler (`@meteorjs/rspack`, `@rspack/*`) is a **devDependency** but is needed by `meteor build`; without the flag the build fails with a misleading "Could not find rspack.config.js".
- The runtime stage runs `npm install --omit=dev`, **not** `npm ci` (`Dockerfile:38`), because Meteor's server bundle ships only `package.json` — no lockfile.

Local `docker compose up` (dev) builds via the `build:` block; deploys leave `IMAGE` unset locally and instead set it to a **digest-pinned GHCR reference** so the host only `pull`s.

### Node 22 pinning (coupled spots)

Node 22 matches Meteor 3.4.1's bundled node and is pinned, with **nothing enforcing consistency**, across:

| Spot | Mechanism |
|------|-----------|
| `package.json` | `engines.node: "22.x"` |
| `Dockerfile` | runtime stage `FROM node:22-slim` |
| `.github/workflows/ci.yml` | `setup-node` `node-version: '22'` (typecheck, lint, test jobs) |
| `.github/dependabot.yml` | ignores `node` bumps for npm + docker ecosystems |
| `setup.sh` / `setup.ps1`, `README.md`, this docs tree | hand-maintained references |

`@types/node` is held on **v20** (Dependabot ignores its major bump) to match Meteor's bundled node typings — do not let it drift to 22.

### CI gate (ci.yml)

Triggered on PRs to `main` and pushes to `main`. Three parallel jobs; for the same ref, in-flight PR runs are cancelled (`concurrency.cancel-in-progress` is PR-only).

| Job | Needs Meteor? | What it runs | Timeout |
|-----|---------------|--------------|---------|
| `typecheck` | No (pure Node) | `npm ci` → `npm run typecheck` (`tsc --noEmit`) | 5 min |
| `lint` | No (pure Node) | `npm ci` → `npm run lint` (`eslint .`) | 5 min |
| `mocha + e2e` | Yes | install Meteor → `meteor npm test` → `playwright install --with-deps chromium` → `meteor npm run e2e` | 30 min |

The typecheck/lint jobs need **no Meteor binary**: `meteor/*` imports resolve through ambient declarations, so `tsc` runs in ~40 s with a warm npm cache. The slow job caches `~/.meteor` keyed on `hashFiles('.meteor/release')`, so a Meteor bump self-invalidates. On failure, the Playwright HTML report and traces upload as artifacts (7-day retention). The workflow token is `contents: read` only.

### Image publish (build-publish.yml — reusable)

The single privileged surface: the only place that logs into GHCR and runs the scanner. It is a `workflow_call` reusable workflow, deliberately **tag-agnostic** — the caller passes exact `docker/metadata-action` `tags:` directives, because `metadata-action`'s context-derived tags would mislabel a cross-branch build (deploy builds a feature branch while the workflow file is read from `main`).

Flow: checkout `inputs.ref` → lowercase image name (`ghcr.io/<repo,,>`) → GHCR login → `docker/metadata-action` (caller tags) → `build-push-action` (target `production`, gha layer cache `mode=max`, SBOM + provenance attestations) → resolve **digest-pinned** `name@sha256:...` reference (the `image` output) → Trivy scan → upload SARIF to the Security tab.

| Input | Default | Meaning |
|-------|---------|---------|
| `ref` | (required) | git ref/SHA to check out and build |
| `tags` | (required) | metadata-action tag directives |
| `push` | `true` | `false` = build-only validation (no scan/attest/push) |
| `trivy-exit-code` | `'0'` | `'1'` fails on CRITICAL/HIGH; `'0'` is report-only (SARIF still uploads) |

Trivy currently runs **report-only** (`exit-code: '0'`, `severity: CRITICAL,HIGH`, `ignore-unfixed: true`); `.trivyignore` is an empty curated allowlist. Permissions are scoped per-job (`packages: write`, `security-events: write`, `id-token: write`, `attestations: write`); the top level grants nothing.

### Per-branch preview deploy (deploy.yml + deploy.sh)

Triggered by `workflow_dispatch` (pick a branch) or a push to `main` (auto). `main` is just another stack — no gate. Three jobs:

```
resolve  → validate branch name (regex, no metachars / leading dash / '..') → slugify → sha
build    → build-publish.yml (push=true; tags = <slug>, sha-<short>)
deploy   → SSH to host: render per-stack .env → scp compose+scripts → host GHCR login → run deploy.sh
```

`slugify()` (`scripts/lib-slug.sh`) lowercases, collapses non-`[a-z0-9]` runs to `-`, strips edges, and truncates to 40 chars (room under the 63-char DNS label limit). It is the single source of truth so the Compose project name, Traefik router/service, subdomain, and `ROOT_URL` are always derived identically by both deploy and teardown.

`scripts/deploy.sh` runs **on the host** and is idempotent per slug. Sequence:

1. Preflight: docker + compose v2 present; `docker-compose.yml` + mode-600 `.env` present in `$DIR`.
2. **Stack cap** — only blocks *new* stacks: if `cm-*` count ≥ `MAX_STACKS` (default 6) and this stack doesn't exist, refuse; redeploys always proceed.
3. **Backup** (`--backup`): `mongodump --archive --gzip` *inside* the mongo container (root creds stay in the container env) → `backups/<ts>.archive.gz`, retain last 10. A failed dump **aborts before deploy**.
4. `compose pull` → `compose up -d --remove-orphans`.
5. Poll the `app` container health (`docker inspect ... State.Health.Status`) up to 150 s; on `unhealthy`/timeout, dump last 60 log lines and exit non-zero.
6. `docker image prune -f` (dangling-only — never `system prune -a`, since live stacks share base layers).

Each stack lives in `/opt/cm/<slug>/`. The deploy step pins `-f docker-compose.yml` explicitly so the dev `docker-compose.override.yml` is **not** auto-loaded on the host.

### Stack identity & isolation (docker-compose.yml)

One Compose project `cm-<slug>` namespaces the app container, network, and the **`mongo-data` volume** per branch — so each branch gets its own app *and its own MongoDB* for free. Traefik routing is parameterized so many stacks share one Traefik:

| Compose var | Default | Used for |
|-------------|---------|----------|
| `STACK` | `community-manager` | Traefik router/service name |
| `STACK_HOST` | `${DOMAIN}` | `Host(...)` rule |
| `TRAEFIK_ENTRYPOINT` | `websecure` | router entrypoint |
| `TRAEFIK_CERTRESOLVER` | `letsencrypt` | TLS cert resolver |
| `IMAGE` | `community-manager:latest` | digest-pinned ref to run (unset → local build) |
| `ROOT_URL` | — | must equal `https://$STACK_HOST` exactly (Meteor requirement) |
| `MONGO_URL` | derived from `MONGO_INITDB_ROOT_*` | explicit value wins |

With `STACK`/`STACK_HOST` unset, the router is named `community-manager` and routes `$DOMAIN` — the original single-host behaviour, unchanged. The `app` service is hardened: `read_only: true` + `tmpfs: /tmp`, `cap_drop: ALL`, `no-new-privileges`, 1 GB memory limit, container healthcheck on `GET /`. The `internal` network is `internal: true` (no egress); only `traefik` is external.

### Release (release.yml) and teardown (teardown.yml)

- **Release** fires on a `v*` tag push. The tag *is* the trigger, so `metadata-action`'s semver derivation is correct here (unlike cross-branch deploy). It publishes `{{version}}`, `{{major}}.{{minor}}`, `sha-<short>`, and `latest`, then `gh release create --generate-notes --verify-tag` (categorised by `.github/release.yml` labels). It does **not** deploy.
- **Teardown** fires on `workflow_dispatch` (pick branch, optional `purge`) or a branch `delete`. It SSHes a fresh `teardown.sh` to the host and runs `compose down` (with `--volumes` on branch-delete or opted-in purge). The `delete` event also fires for tags, so the job guards `github.event.ref_type == 'branch'`. **mongodump backups are always preserved.**

### Initial-admin bootstrap

Two distinct paths seed the first login (`server/main.ts`, in `Meteor.startup`):

| Path | When | Credentials | Guard |
|------|------|-------------|-------|
| `createTestData()` | `NODE_ENV !== 'production'` | `admin` / `admin` | dev-only |
| `bootstrapAdminFromSettings()` (`server/main.ts:204`) | empty users collection **and** `Meteor.settings.bootstrapAdmin` set | from settings | no-op once any user exists |

`bootstrapAdminFromSettings()` upserts the `admin` role (`roles: true`) and creates the user via `Accounts.createUserAsync` (correct password hashing). It is how a fresh production/preview stack gets its first login, since `createTestData()` is dev-only — pass `bootstrapAdmin` via `METEOR_SETTINGS`. Startup also runs `createDatabaseIndexes()` (including the audit-log TTL index from `LOGS.retentionSeconds` and the Attendances unique-`eventId` index).

## Dependabot grouping

`.github/dependabot.yml` runs three weekly ecosystems with grouped PRs to cut review noise (most-specific pattern first):

| Ecosystem | Groups | Ignored |
|-----------|--------|---------|
| npm (`/`) | `react`, `tiptap`, `rspack`, `eslint`, `types`, `misc-minor-patch` | `node`; **all** `semver-major` bumps (react 18→19, rspack 1→2, eslint 9→10 break the build) |
| github-actions (`/`) | single `actions` group (keeps SHA/major pins current) | — |
| docker (`/`) | — | `node`, `geoffreybooth/meteor-base` (hand-coupled to Meteor 3.4.1) |

## Gotchas

- **`meteor build` needs `--include=dev`.** The rspack bundler is a devDependency; the meteor-base image's `NODE_ENV=production` otherwise omits it and the build dies with a misleading "Could not find rspack.config.js". (`Dockerfile:11-16`)
- **Node 22 is pinned in ~6 uncoupled spots** (`engines.node`, Dockerfile, CI, setup scripts, README, deployment docs) with nothing enforcing agreement. Don't trust `*-LTS` (now Node 24). Keep `@types/node` on v20.
- **`ROOT_URL` must equal `https://$STACK_HOST` exactly** — Meteor requirement; the deploy workflow renders it that way, but a manual `.env` that mismatches breaks the app silently.
- **`tests/` is intentionally not in `.dockerignore`** — `package.json` references `tests/main.ts` as `meteor.testModule` and Meteor resolves the path even in production builds. Removing it breaks `meteor build`.
- **`.meteorignore` must exclude *all* of `e2e/`** — partial excludes leave Playwright's transient writes visible to Meteor HMR, triggering a mid-test `forceBrowserReload` that wipes form state and notifications.
- **Don't run `npm test` while `meteor run` is up** — both share `.meteor/local`; the test run desyncs the dev server's method registry. Recover by restarting the dev server.
- **The runtime stage uses `npm install`, not `npm ci`** — the Meteor server bundle ships no lockfile, so `npm ci` would fail.
- **Preview Mongo lives in a per-stack volume**, purged on branch-delete (data disposable) and on opt-in `--purge`. A manual teardown without `--purge` keeps the volume so a redeploy retains data. Backups under `/opt/cm/<slug>/backups/` always survive.
- **Trivy is report-only today** (`trivy-exit-code: '0'`). CRITICAL/HIGH findings do **not** fail the build yet — flip callers to `'1'` once `.trivyignore` is curated.
- **`server/config.ts` exports getters, not values.** Spreading or destructuring `RATE_LIMITS`/`LOGS` at import time freezes the value and defeats live `Meteor.settings` overrides — read the property at the point of use.
- **Stack cap only blocks new stacks.** `MAX_STACKS` (default 6, set via `MAX_PREVIEW_STACKS` repo variable) guards host RAM (~1 GB/stack); redeploys of an existing stack always proceed.
- **`setup.sh` mode flips on WSL checkouts** (`100755`→`100644`); fix locally with `git config core.fileMode false`, never globally and never via `.gitattributes`. (See CLAUDE.md → *Common Gotchas* → Windows/WSL.)

## See also

- [crud-engine.md](./crud-engine.md) — the mutation pipeline whose rate-limit buckets and role-cache TTL come from `server/config.ts`.
- [permissions-rbac.md](./permissions-rbac.md) — `CACHE.roleTtlMs` and `SQUAD_SCOPED_PERMISSIONS.enabled` feed the RBAC subsystem; the `admin` role seeded at bootstrap.
- [server-apis.md](./server-apis.md) — the backup methods whose rate limits live in `RATE_LIMITS`, and the audit-log retention behind `LOGS.retentionSeconds`.
- [testing.md](./testing.md) — the Mocha + Playwright suites the `mocha + e2e` CI job runs (`e2e/playwright.config.ts`, `capture-views.mjs`).
- [data-model.md](./data-model.md) — the collections indexed at startup by `createDatabaseIndexes()`.
- CONTEXT.md → **CollectionPermissionRegistry** (the registry whose `module`/`fallback` gate the permission checks configured here).
- Root docs: `docs/deployment.md` (host setup, GitHub secrets/variables, single-host vs preview), `CLAUDE.md` → *Configuration* / *Deployment* / *Common Gotchas*, `settings.example.json`, `.env.example`, `docs/adr/`.
