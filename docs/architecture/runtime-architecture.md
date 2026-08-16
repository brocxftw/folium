# Runtime architecture

How Folium processes actually run in the Compose stack versus local development.

---

## Compose services

| Service | Process | Command | Depends on |
|---------|---------|---------|------------|
| `db` | PostgreSQL 17 + pgvector | image default | — |
| `api` | Uvicorn FastAPI | entrypoint → `uvicorn folium.main:app --host 0.0.0.0 --port 8000` | healthy `db`; runs `alembic upgrade head` first |
| `worker` | asyncio worker loop | `folium-worker` | healthy `db` and healthy `api` |
| `web` | nginx | image default | healthy `api` |

**Confirmed:** `api` and `worker` share `docker/Dockerfile.backend`. The worker does **not** run migrations (entrypoint skips Alembic when argv is `folium-worker`). Ordering `worker → api healthy` exists so schema is migrated before jobs run (**Inference:** that is the intent of `depends_on`).

Worker has **no Compose healthcheck**. Heartbeat is written to `app_settings` key `worker_heartbeat` (**Confirmed**); it is not part of `GET /health`.

---

## Network and ports

| Port (host → container) | Service |
|-------------------------|---------|
| `8080 → 80` | `web` (primary UI) |
| `8000 → 8000` | `api` (direct OpenAPI / health) |
| `5433 → 5432` | `db` (dev/psql convenience) |

Frontend origin default: `http://localhost:8080` (`FRONTEND_ORIGIN`). CORS allows that origin with credentials.

Dev (non-Compose): Vite listens on **8080** and proxies `/api` and `/health` to `localhost:8000`. Running Compose `web` and Vite on 8080 at once will conflict (**Configuration-dependent**).

---

## Process roles

### API

- Serves REST and OpenAPI.
- Authenticates cookie sessions.
- Writes documents/metadata and **enqueues** jobs; does not run OCR/indexing in-request except Ask/search embedding of the **query** when semantic/hybrid search is requested.
- Bootstrap on startup: storage directories, first admin, system folders, `ai_settings` row.

### Worker

Loop (sleep `JOB_POLL_INTERVAL_SECONDS`, default 2s):

1. Requeue stale `RUNNING` jobs (startup: all running; loop: heartbeat older than `JOB_STALE_RUNNING_SECONDS`).
2. Claim up to `JOB_CONCURRENCY` jobs.
3. Poll `/consume` for stable files.
4. Periodically purge expired trash.
5. Fire-and-forget AI provider probes (must not block OCR).

### Web

Serves `frontend/dist`. Proxies API. SPA fallback `try_files` → `index.html`. `client_max_body_size 110m` (aligned with default 100 MB upload plus overhead).

---

## Source-built vs distributable

**Confirmed mixture leaning source-built:**

- Images are **built locally** from the git tree (`build: context: .`).
- Frontend is compiled **inside** the `web` image; runtime `web` does not mount SPA source.
- Backend image copies `backend/src` at **build** time. Default Compose does **not** bind-mount source. `docker-compose.debug.yml` **does** mount `./backend/src` for live API/worker code.
- Bind mounts for **data** (`./data/documents` etc.) are runtime, not source.

Users today: `git clone` → configure `.env` → `docker compose build && up`. Pre-built registry images are **not implemented**.

---

## Identity and version

`GET /health` `version` comes from `FOLIUM_VERSION` env, else `git describe`, else `0.1.0`. Docker images typically have no `.git`, so production Compose **should** set `FOLIUM_VERSION`. Default Compose **does not** set it (**Confirmed** gap).

---

## Concurrency and isolation

- One worker process per `worker` container; in-process asyncio semaphore = `JOB_CONCURRENCY` (default 2).
- Inbox **preflight** jobs are gated so only one still-preparing Inbox document is claimed at a time (oldest first).
- Trashed-document jobs are skipped/cancelled so deletes do not starve the queue.
- OCR uses a dedicated thread executor (Paddle constraint).

---

## Failure domains

| Failure | Effect |
|---------|--------|
| `db` down | API/worker cannot start or serve |
| `/documents` unwritable | Uploads rejected; metadata remains |
| `/consume` unwritable | Consume ingest stops; `/health/storage` degraded if documents still OK |
| AI provider down | Jobs that need AI fail/retry/soft-fail; keyword DMS continues; `/health` still `ok` |
| `web` down | UI unavailable; API still on :8000 |
