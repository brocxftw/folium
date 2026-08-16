# Local development

Developer workflow as verified in the repo (`Makefile`, README scripts, Vite, pytest). Separate from [end-user Compose](../deployment/overview.md).

## Prerequisites

- Docker (for Postgres + optional full stack)
- Python 3.13 + [uv](https://docs.astral.sh/uv/)
- Node 20 + npm
- Git

## Environment

```bash
cp .env.example .env
# Point DATABASE_URL at localhost:5433 when API runs on the host
docker compose up -d db
```

Host API defaults in Settings already use `localhost:5433`. Compose `api` overrides URLs to hostname `db`.

## Backend

```bash
cd backend
uv venv --python 3.13
uv pip install -e ".[dev]"          # OCR extra optional; Docker image uses .[ocr]
.venv/bin/alembic upgrade head
.venv/bin/uvicorn folium.main:app --reload --port 8000
# other terminal:
.venv/bin/folium-worker
```

`FOLIUM_ENV=development` enables uvicorn reload when using `folium-api`.

CLI: `folium reset-admin-password`.

## Frontend

```bash
cd frontend
npm install
npm run dev          # :8080, proxies /api and /health → :8000
```

Do not run Compose `web` on 8080 at the same time as Vite.

## Full stack

```bash
make build && make up    # docker compose build && up -d
make logs
```

Hot reload of Python in Compose requires `docker-compose.debug.yml` source mounts (or rebuild). Frontend in Compose is a **production nginx build**, not Vite HMR.

## Tests

See [testing.md](testing.md).

## Migrations

```bash
make migrate
# or: cd backend && .venv/bin/alembic upgrade head
```

New revisions: standard Alembic in `backend/alembic/versions/`.
