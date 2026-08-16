# Deployment overview

## Current supported model

**Confirmed:** operators **clone this repository**, copy `.env.example` → `.env`, optionally create `data/*` directories, then:

```text
docker compose build
docker compose up -d
```

Folium is **not** distributed as published GHCR/Docker Hub images in this repo. There is no standalone `docker-compose.yml` that only `image:`-pulls Folium services.

Mixture: **Postgres image is pulled**; **api/worker/web are built from source**.

End-user vs developer: Compose is the intended runtime for homelab use **and** is source-built. Local Vite/uvicorn is documented separately under [development](../development/local-development.md).

---

## What you get

| URL | Service |
|-----|---------|
| http://localhost:8080 | UI |
| http://localhost:8000/docs | OpenAPI |
| http://localhost:8000/health | API liveness + version |

First boot creates the bootstrap admin from `FOLIUM_ADMIN_USERNAME` / `FOLIUM_ADMIN_PASSWORD` if no users exist.

---

## Further reading

- [Docker](docker.md)
- [Storage mounts](storage-mounts.md)
- [Environment variables](environment-variables.md)
- [Healthchecks](healthchecks.md)
- [Production readiness](production-readiness.md) (public-release audit — not a how-to)
