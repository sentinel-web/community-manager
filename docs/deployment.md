# Deployment

Two ways to run the app, both Docker + Traefik:

- **[Single-host production](#single-host-production)** — one canonical instance at your domain.
- **[Per-branch preview environments](#per-branch-preview-environments)** — any branch (incl. `main`) deployed as an isolated stack at `<slug>.<base-domain>` from a GitHub Actions workflow. The single host runs them all side by side.

The images are built and published by CI (`.github/workflows/build-publish.yml`) to **GHCR** (`ghcr.io/sentinel-web/community-manager`). The host never builds — it pulls a digest-pinned image.

## Single-host production

```bash
# Required environment variables (.env)
ROOT_URL=https://yourdomain.com
DOMAIN=yourdomain.com
MONGO_INITDB_ROOT_USERNAME=...           # required, no default
MONGO_INITDB_ROOT_PASSWORD=...           # required, no default

# Optional
TRAEFIK_ENTRYPOINT=websecure             # default
TRAEFIK_CERTRESOLVER=letsencrypt         # default
# IMAGE=ghcr.io/sentinel-web/community-manager:latest   # else builds locally

docker network create traefik            # once, if not present
docker compose up -d
```

- Multi-stage Dockerfile: builds the Meteor app, runs on Node 22.
- Requires the external `traefik` network (assumes a Traefik reverse proxy).
- MongoDB 7 with health checks and a persistent volume.
- With `STACK` / `STACK_HOST` unset, the Traefik router is named `community-manager` and routes `$DOMAIN` — the original behaviour, unchanged.

See `docker-compose.yml` for the full configuration.

## Per-branch preview environments

A developer triggers **Actions → deploy → Run workflow**, picks a branch, and that branch goes live at `https://<slug>.<base-domain>`. Pushing to `main` deploys `main.<base-domain>` automatically. `main` is treated like any other stack — no gate.

```
deploy.yml ── resolve (validate branch → slug + SHA)
           └─ build  (build-publish.yml → GHCR, digest-pinned)
           └─ deploy (SSH: render .env → backup DB → compose -p cm-<slug> up -d)

Traefik   https://<slug>.<base-domain>  →  cm-<slug>-app   (router/service name = <slug>)
```

### How isolation works

- **Stack** = one Compose project `cm-<slug>`, where `<slug>` is the branch name sanitized to a DNS label (`feature/Issue-12` → `feature-issue-12`). Compose namespaces the containers, network, **and the `mongo` volume** per project, so each branch gets its own app **and its own MongoDB** for free.
- **Traefik** routers/services are named per `<slug>` (parameterized in `docker-compose.yml`), so many stacks share one Traefik without router-name collisions.
- Each stack lives in `/opt/cm/<slug>/` on the host (its `docker-compose.yml` + a mode-600 `.env` + `backups/`).

### One-time host setup

1. Docker Engine + Compose v2, the external `traefik` network, and a running Traefik with the `letsencrypt` (HTTP-01) cert resolver — same as production.
2. A deploy user whose `~/.ssh/authorized_keys` holds the public half of `DEPLOY_SSH_KEY`, and which can run `docker`.
3. **Wildcard DNS:** `*.<base-domain>` → the host's IP. Traefik then mints a per-host cert for each `<slug>.<base-domain>` on first request via HTTP-01 — no wildcard certificate needed. (Watch Let's Encrypt's 50-certs/registered-domain/week limit; switch Traefik to a DNS-01 wildcard cert if branch churn is high.)
4. First GHCR publish creates the package — in its settings, link it to this repo so the workflow's `GITHUB_TOKEN` retains pull access.

### GitHub secrets & variables

Set under **Settings → Secrets and variables → Actions**.

| Name | Kind | Purpose |
|------|------|---------|
| `DEPLOY_SSH_KEY` | secret | Private key for the deploy user. |
| `DEPLOY_HOST` | secret | Host/IP to SSH into. |
| `DEPLOY_USER` | secret | SSH user that owns the stacks. |
| `SSH_KNOWN_HOSTS` | secret | Output of `ssh-keyscan <host>` — pins the host key (strict checking). |
| `MONGO_INITDB_ROOT_USERNAME` | secret | Mongo root user for the stacks. |
| `MONGO_INITDB_ROOT_PASSWORD` | secret | Mongo root password. |
| `METEOR_SETTINGS` | secret (optional) | Compact (single-line) JSON for `Meteor.settings`. |
| `BASE_DOMAIN` | variable | Wildcard base, e.g. `preview.example.com`. `STACK_HOST = <slug>.<base>`. |
| `TRAEFIK_ENTRYPOINT` | variable (optional) | Defaults to `websecure`. |
| `TRAEFIK_CERTRESOLVER` | variable (optional) | Defaults to `letsencrypt`. |
| `MAX_PREVIEW_STACKS` | variable (optional) | Cap on concurrent stacks (default 6). Guards host RAM — each stack runs its own app + mongo (~1 GB). |

GHCR push/pull uses the built-in `GITHUB_TOKEN`; no registry secret is required.

### Deploying & tearing down

- **Deploy:** Actions → **deploy** → Run workflow → enter a branch. (Or merge to `main`.) The job backs up the stack's DB (`mongodump`, kept under `/opt/cm/<slug>/backups/`, last 10 retained) **before** pulling, then `docker compose -p cm-<slug> up -d` and waits for the container healthcheck.
- **Tear down:** Actions → **teardown** → Run workflow → enter a branch (tick *purge* to also drop its Mongo volume). Deleting a branch on GitHub auto-tears-down its stack (and purges the volume, since the data is disposable then). Backups are always preserved.
- **List stacks on the host:** `bash /opt/cm/<any-slug>/teardown.sh --list`.

### Releases

Pushing a `v*` tag (`release.yml`) publishes a versioned + `latest` image and creates a GitHub Release with generated notes. It does **not** deploy — ship a release by merging to `main` or dispatching **deploy**.
