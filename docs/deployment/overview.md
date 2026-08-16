# Deployment overview

## Supported model

Operators install **pre-built images** from GHCR. They download `docker-compose.yml` and `.env.example` from a GitHub Release — no git clone and no Folium image build.

```text
download docker-compose.yml
download .env.example
configure .env
docker compose up -d
```

Step-by-step: [Install](install.md).

Postgres is pulled from Docker Hub (`pgvector/pgvector:pg17`). Folium `api`/`worker`/`web` are pulled from GHCR.

## What you get

| URL | Service |
|-----|---------|
| http://localhost:8080 | UI |
| http://localhost:8000/docs | OpenAPI |
| http://localhost:8000/health | API liveness + version |

First boot creates the bootstrap admin from `FOLIUM_ADMIN_USERNAME` / `FOLIUM_ADMIN_PASSWORD` if no users exist.

## Contributors

Clone the repository and source-build with [compose.dev.yaml](../../compose.dev.yaml):

```bash
docker compose -f docker-compose.yml -f compose.dev.yaml up --build -d
```

See [local development](../development/local-development.md).

## Further reading

- [Install](install.md)
- [Upgrades](upgrades.md)
- [Backup](backup.md)
- [Docker](docker.md)
- [Storage mounts](storage-mounts.md)
- [Environment variables](environment-variables.md)
- [Healthchecks](healthchecks.md)
- [Production readiness](production-readiness.md)
