# Docker

## Service table

| Service | Purpose | Image | Command | Depends on |
|---------|---------|-------|---------|------------|
| `db` | PostgreSQL 17 + pgvector | Pulled `pgvector/pgvector:pg17` | image default | — |
| `api` | FastAPI | Pulled `ghcr.io/brocxftw/folium-backend` | `alembic upgrade head` then uvicorn | `db` healthy |
| `worker` | Jobs + consume + purge | **Same** backend image | `folium-worker` (no migrations) | `db` + `api` healthy |
| `web` | SPA + reverse proxy | Pulled `ghcr.io/brocxftw/folium-web` | nginx | `api` healthy |

Restart: `unless-stopped` on all four. `security_opt: no-new-privileges:true` on app containers. `api`/`worker` `user: "1000:1000"`. Public Compose does **not** set `group_add`.

## Images

**Backend:** `python:3.13-slim-bookworm`, pinned `uv`, PaddlePaddle CPU + `.[ocr]`, Alembic, entrypoint `docker/backend-entrypoint.sh`. Exposes 8000. Same image for API and worker.

**Frontend:** multi-stage `node:20` `npm ci && npm run build` → `nginx:1.27-alpine` + `docker/nginx.conf`.

Build context for contributors is the **repository root**. Published tags: `X.Y.Z`, `X.Y`, `latest` (stable tags only), `sha-<shortsha>`. Platform: **linux/amd64**. ARM is untested.

OCI labels include source URL `https://github.com/brocxftw/folium` and licence `AGPL-3.0-only`. Build-args set `FOLIUM_VERSION`, `FOLIUM_BUILD_REVISION`, `FOLIUM_BUILD_DATE`.

## Compose files

| File | Role |
|------|------|
| `docker-compose.yml` | Public: `image:` only (GitHub Release asset) |
| `compose.dev.yaml` | Overlay: `build:` + Postgres `5433` |
| `docker-compose.debug.yml` | Optional live Python mounts |

Contributor command:

```bash
docker compose -f docker-compose.yml -f compose.dev.yaml up --build -d
```

`make build` / `make up` use that overlay.

## Ports

Public: `8080:80` (web), `8000:8000` (api). Postgres is **not** published. The development overlay maps `5433:5432`.

## Migrations

Only the **api** entrypoint runs Alembic. Failures abort startup (`set -e`). Worker waits until api is healthy so it never processes against an unmigrated schema.

## Publishing

`.github/workflows/publish-images.yml` runs on `v*` tags: tests, amd64 build, compose smoke (`GET /health`), push to GHCR, upload Release assets (`docker-compose.yml`, `.env.example`, `checksums.txt`). Packages must be made **public** once (see [install](install.md)).
