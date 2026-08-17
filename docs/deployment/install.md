# Install Folium (images)

**Primary path:** the [interactive installer](installer.md). This page is the manual Compose alternative.

Requirements: Docker and Docker Compose on **linux/amd64**. ARM is unsupported.

## GHCR packages must be public

Anonymous `docker compose up` needs public packages:

- `ghcr.io/brocxftw/folium-backend`
- `ghcr.io/brocxftw/folium-web`

**One-time maintainer step after the first successful publish:** GitHub → Packages → each package → Package settings → Change package visibility → **Public**. Link the package to the `brocxftw/folium` repository if GitHub has not already done so from OCI `org.opencontainers.image.source`.

End users must **not** run `docker login ghcr.io`.

## Install

```bash
mkdir folium
cd folium

curl -fsSL -o docker-compose.yml \
  https://github.com/brocxftw/folium/releases/latest/download/docker-compose.yml
curl -fsSL -o env.example \
  https://github.com/brocxftw/folium/releases/latest/download/env.example

cp env.example .env
```

Edit `.env`:

1. `FOLIUM_SECRET_KEY` and `FOLIUM_ENCRYPTION_KEY` — `openssl rand -hex 32` for each
2. `POSTGRES_PASSWORD` — required; use hex (`openssl rand -hex 24`). Do not use `@ : / # ?` in the password
3. `FOLIUM_ADMIN_PASSWORD` — first-boot admin only
4. `FRONTEND_ORIGIN` — the URL you will open in the browser (default `http://localhost:8080`)
5. Host bind paths if you do not want `./data/...`

```bash
mkdir -p data/documents data/consume data/export data/paddleocr
# containers run as UID 1000
sudo chown -R 1000:1000 data/documents data/consume data/export data/paddleocr

docker compose up -d
```

UI: http://localhost:8080  
Health (via nginx): http://localhost:8080/health  
OpenAPI: http://localhost:8080/docs (or http://localhost:8000/docs if you publish port 8000)

Bootstrap admin is created **only** when the users table is empty.

Open registration defaults to **off**. Add further users with admin invites.

## What Docker pulls

| Service | Image |
|---------|--------|
| `api`, `worker` | `ghcr.io/brocxftw/folium-backend:<version>` |
| `web` | `ghcr.io/brocxftw/folium-web:<version>` |
| `db` | `pgvector/pgvector:pg17` (upstream) |

Release Compose files default `FOLIUM_VERSION` to that release (for example `0.1.16`), so you do not accidentally pull a newer `latest` than the files you downloaded.

## First OCR run

PaddleOCR models download into the `FOLIUM_PADDLE_CACHE_HOST` bind on first OCR. Keep that directory on local disk.

## Extra host GID (optional)

Public Compose does not add extra groups. If a bind mount is `0770` for a host group, create a gitignored `docker-compose.override.yml`:

```yaml
services:
  api:
    group_add:
      - "10000"
  worker:
    group_add:
      - "10000"
```

## Next

- [Upgrades](upgrades.md)
- [Backup](backup.md)
- [Environment variables](environment-variables.md)
- Source-build (contributors): [local development](../development/local-development.md)
