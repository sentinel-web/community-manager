# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
FROM geoffreybooth/meteor-base:3.4 AS builder

WORKDIR /app

COPY package*.json ./
COPY .meteor .meteor

# --include=dev is required: the rspack bundler (@meteorjs/rspack, @rspack/*)
# lives in devDependencies but is needed at build time by `meteor build`. The
# meteor-base image runs with NODE_ENV=production, which npm treats as
# --omit=dev — without this flag the build fails with a misleading
# "Could not find rspack.config.js" (it means node_modules/@meteorjs/rspack).
RUN meteor npm ci --include=dev

COPY . .

RUN meteor build --server-only --directory /built-app

# ---------- Production stage ----------
FROM node:22-slim AS production

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends tini curl ca-certificates \
    # Security floor: fail the build if apt-get upgrade did not reach the
    # bookworm release fixing CVE-2026-45447 et al. in openssl/libssl3. The CI
    # layer cache (cache-from: type=gha) replays this RUN's old result until
    # its text changes, so apt-get upgrade alone can silently keep shipping
    # stale packages — bump the floor version here to force a fresh layer.
    && for pkg in openssl libssl3; do \
        v="$(dpkg-query -W -f='${Version}' "$pkg")"; \
        dpkg --compare-versions "$v" ge "3.0.20-1~deb12u2" \
            || { echo "$pkg $v is older than required 3.0.20-1~deb12u2" >&2; exit 1; }; \
    done \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@latest \
    && npm cache clean --force \
    && groupadd --system --gid 1001 meteor \
    && useradd --system --uid 1001 --gid meteor --home /app --shell /usr/sbin/nologin meteor

WORKDIR /app

COPY --from=builder --chown=meteor:meteor /built-app/bundle ./

WORKDIR /app/programs/server
# Meteor's server bundle ships only package.json (no lockfile), so `npm ci`
# cannot be used here — install resolves deps from package.json directly.
#
# discord.js's native add-ons (zlib-sync, bufferutil, utf-8-validate) are
# node-gyp modules, so the install needs a C/C++ toolchain + Python to compile
# them. Install the toolchain, build, then purge it in the same layer so the
# slim runtime image keeps only the compiled .node artifacts, not the compilers.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

USER meteor

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "main.js"]
