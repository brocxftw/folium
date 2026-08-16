# Docker

## Service table

| Service | Purpose | Built/Pulled | Command | Depends on |
|---------|---------|--------------|---------|------------|
| `db` | PostgreSQL 17 + pgvector | Pulled `pgvector/pgvector:pg17` | image default | — |
| `api` | FastAPI | **Built** `docker/Dockerfile.backend` | `uvicorn folium.main:app --host 0.0.0.0 --port 8000` after `alembic upgrade head` | `db` healthy |
| `worker` | Jobs + consume + purge | **Built** same Dockerfile | `folium-worker` | `db` + `api` healthy |
| `web` | SPA + reverse proxy | **Built** `docker/Dockerfile.frontend` | nginx | `api` healthy |

Restart: `unless-stopped` on all four. Network: default Compose network. `security_opt: no-new-privileges:true` on app containers. `api`/`worker` `user: "1000:1000"` plus `group_add: ["10000"]`.

---

## Images and build

**Backend:** `python:3.13-slim-bookworm`, system `uv pip install` including PaddlePaddle CPU from Paddle’s index + `.[ocr]`. Copies `backend/src`, Alembic. Entrypoint `docker/backend-entrypoint.sh`. Exposes 8000.

**Frontend:** multi-stage `node:20` `npm ci && npm run build` → `nginx:1.27-alpine` + `docker/nginx.conf`.

Build context is **repository root**. `.dockerignore` excludes `.git`, `data/**`, `.env`, `*.md` (except backend copy of `README.md*` if present).

---

## Ports

`8080:80` (web), `8000:8000` (api), `5433:5432` (db).

---

## Debug overlay

`docker-compose.debug.yml` bind-mounts `./backend/src` into api/worker for live Python without rebuild. Not required for normal operation.

---

## Migrations

Only **api** entrypoint runs Alembic. Worker waits until api is healthy (Compose condition).
