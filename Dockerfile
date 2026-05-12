# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
FROM geoffreybooth/meteor-base:3.4 AS builder

WORKDIR /app

COPY package*.json ./
COPY .meteor .meteor

RUN meteor update --npm && meteor npm ci

COPY . .

RUN meteor build --server-only --directory /built-app

# ---------- Production stage ----------
FROM node:20-slim AS production

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 meteor \
    && useradd --system --uid 1001 --gid meteor --home /app --shell /usr/sbin/nologin meteor

WORKDIR /app

COPY --from=builder --chown=meteor:meteor /built-app/bundle ./

WORKDIR /app/programs/server
# Meteor's server bundle ships only package.json (no lockfile), so `npm ci`
# cannot be used here — install resolves deps from package.json directly.
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

USER meteor

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "main.js"]
