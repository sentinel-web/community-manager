# Deployment

**Docker with Traefik** (production)

```bash
# Required environment variables
ROOT_URL=https://yourdomain.com
DOMAIN=yourdomain.com
MONGO_URL=mongodb://mongo:27017/community-manager  # default

# Optional Traefik settings
TRAEFIK_ENTRYPOINT=websecure                       # default
TRAEFIK_CERTRESOLVER=letsencrypt                   # default

# Build and run
docker compose up -d
```

- Multi-stage Dockerfile: builds Meteor app, runs on Node 22
- Requires external `traefik` network (assumes Traefik reverse proxy)
- MongoDB 7 with health checks and persistent volume

See `docker-compose.yml` for the full configuration.
