# Folium

Self-hosted **document management** for homelabs and private Docker hosts. Organisation, OCR, and keyword search are core. Embeddings, filing suggestions, and Ask Folium are **optional**.

> Document management first. AI is an enhancement, not infrastructure.

Engineering detail lives in [`docs/`](docs/README.md). This README is the front door, not the source of truth.

## Why Folium

- **Self-hosted** — Compose stack; your storage and PostgreSQL
- **Document management first** — Inbox, folders, tags, trash work without an LLM
- **AI optional** — no provider required for ingest, OCR, or keyword search
- **Privacy-conscious** — application-enforced privacy modes; provider “no training” flags are claims, not guarantees
- **Human-controlled filing** — Process is the Inbox gate to final chunk indexing

## Features

### Document management

- Per-owner library: logical folders, tags, document types, correspondents
- Inbox review queue and explicit **Process**
- Archive flag vs Trash (soft-delete + retention purge)
- Bulk move / tag / trash / archive
- Multi-user accounts, invites, quotas, admin-approved password reset

### OCR and ingestion

- Upload and `/consume` drop folder
- Content-addressed originals (SHA-256); duplicates by checksum
- PDF text (PyMuPDF), DOCX, text/markdown, images
- Local **PaddleOCR PP-OCRv6** (CPU) for scans — no LLM required

### Search and retrieval

- **Browse** empty-query lists vs **evidence search** (`POST /api/search`)
- Keyword (PostgreSQL FTS) always
- Semantic / hybrid (RRF) when embeddings exist; otherwise **keyword fallback**

### Optional AI

- Filing **suggestions** (not canonical until accepted)
- Chunk **embeddings** for hybrid search and Ask
- **Ask Folium** with validated chunk citations
- Document Ask can persist a thread; workspace Ask does not
- OpenAI-compatible, Anthropic, Gemini adapters; local or remote subject to policy

### Administration

- Settings: Profile, Artificial Intelligence, Library, System, Logs, About
- Jobs view and cancel
- Application logs in PostgreSQL
- Health: `/health`, `/health/database`, `/health/storage`
- **MCP** at `/mcp` (Bearer API token from Settings → Profile): search evidence, search documents, read a document, browse folders. Read-only; Ask Folium is not an MCP tool.

## How it works

```text
Upload / Consume
  → Extract / OCR
  → Inbox
  → Review
  → Process
  → Index (chunks)
  → Optional embeddings
  → Search / Ask
```

Library uploads that already specify a folder can skip Inbox and index after preflight.

Architecture: [`docs/architecture/overview.md`](docs/architecture/overview.md)

```text
Browser → web (nginx) → api (FastAPI) → PostgreSQL + files
                              ↓
                         jobs table → worker (OCR, index, embed)
```

## AI is optional

Without chat, embeddings, or remote APIs, Folium still:

- Ingests and OCRs documents
- Files via Inbox / Process
- Searches with **keyword** FTS

Ask, semantic search, auto-suggestions, and summaries need configured providers and privacy flags. Unreachable AI does **not** fail `/health`.

Details: [`docs/backend/ai-and-rag.md`](docs/backend/ai-and-rag.md)

## Installation

**Primary path:** interactive installer (one file). Review it, then run it:

```bash
curl -fsSL -o install-folium.sh \
  https://github.com/brocxftw/folium/releases/latest/download/install-folium.sh
less install-folium.sh
bash install-folium.sh
```

This writes `/opt/folium`, pulls GHCR images, and installs `folium` (`status` / `start` / `stop` / `logs` / `doctor`). Guide: [`docs/deployment/installer.md`](docs/deployment/installer.md).

Manual Compose (no TUI): [`docs/deployment/install.md`](docs/deployment/install.md)

```bash
mkdir folium && cd folium
curl -fsSL -o docker-compose.yml \
  https://github.com/brocxftw/folium/releases/latest/download/docker-compose.yml
curl -fsSL -o env.example \
  https://github.com/brocxftw/folium/releases/latest/download/env.example
cp env.example .env
# set FOLIUM_SECRET_KEY, FOLIUM_ENCRYPTION_KEY, POSTGRES_PASSWORD, FOLIUM_ADMIN_PASSWORD
mkdir -p data/documents data/consume data/export data/paddleocr
sudo chown -R 1000:1000 data/documents data/consume data/export data/paddleocr
docker compose up -d
```

UI: http://localhost:9398 — bootstrap admin from `.env` **on first start only**.  
OpenAPI is proxied at http://localhost:9398/docs (host API port 9099 is unpublished unless you opt in). MCP: http://localhost:9398/mcp.

Locked out of every admin: `docker compose exec -it api folium reset-admin-password`

### Updating

Operators pull published GHCR images. Do not `git pull` or `docker compose build` on a production install.

**1. Installer (primary).** Re-run the same script. When it detects `/opt/folium` (or your install dir), choose **Update**. Secrets and document data stay in place; Compose pulls the pinned release images and restarts. The `folium update` CLI command is still a stub — use the installer TUI.

```bash
curl -fsSL -o install-folium.sh \
  https://github.com/brocxftw/folium/releases/latest/download/install-folium.sh
less install-folium.sh
bash install-folium.sh
```

**2. Manual Compose.** In the directory with `docker-compose.yml` and `.env`, pin the release and recreate:

```bash
# in .env
FOLIUM_VERSION=0.1.22

docker compose pull
docker compose up -d
```

Do not `docker compose down -v`. The API runs migrations on start. Confirm with `curl -sS http://localhost:9398/health` (`"version"` should match the pin). Full notes and rollback limits: [`docs/deployment/upgrades.md`](docs/deployment/upgrades.md).

Contributors building from source: [`docs/development/local-development.md`](docs/development/local-development.md)

Deployment: [`docs/deployment/`](docs/deployment/overview.md)

## Configuration

Copy `.env.example`. Compose builds `DATABASE_URL` from `POSTGRES_*`. AI policy env vars **seed** the database once; later changes are in Settings.

Verified reference: [`docs/deployment/environment-variables.md`](docs/deployment/environment-variables.md)

## Storage

Logical folders are metadata. Blobs stay under `/documents/originals/{aa}/{checksum}.ext`.  
Folium does **not** mount NFS — bind-mount host paths (optionally NFS-mounted on the host). Keep PostgreSQL on a **local** Docker volume.

[`docs/architecture/storage.md`](docs/architecture/storage.md)

## Documentation

**Start here:** [`docs/README.md`](docs/README.md)

Vocabulary: [`ubiquitous-language.md`](ubiquitous-language.md)

## Development

Host API + Vite, or Compose. See [`docs/development/local-development.md`](docs/development/local-development.md).

```bash
make test          # backend pytest + frontend vitest/build + installer helpers
```

## Repository structure

```text
backend/     FastAPI, worker, Alembic, tests
frontend/    React SPA
docker/      Dockerfiles, nginx
installer/   Whiptail TUI, bootstrap, management CLI
docs/        Architecture and operations
```

## Current limitations / project status

- GHCR images are **linux/amd64**; ARM is untested ([`production-readiness.md`](docs/deployment/production-readiness.md))
- Packages must be **public** on GHCR after the first publish (one-time maintainer step)
- `/export` is mounted but unused for document export
- Backup V1 is full local `.folium` bundles only (no incremental/cloud/browser upload)
- No SMTP; password reset is admin-approved
- No browser end-to-end test suite
- `classification` job type exists without a handler
- Database migrations are forward-only; image rollback does not undo schema changes

## Contributing

[`docs/development/contributing.md`](docs/development/contributing.md)

## Licence

Folium is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This matches the copyleft terms of PyMuPDF, which Folium uses for PDF text extraction and rendering. See also the dependency notes in [`docs/deployment/production-readiness.md`](docs/deployment/production-readiness.md). This is not legal advice.

## Acknowledgements

Built with FastAPI, PostgreSQL, [pgvector](https://github.com/pgvector/pgvector), React, PaddleOCR, PyMuPDF, and nginx. Inspired by the operational shape of self-hosted document managers such as Paperless-ngx, without being a fork of that project.
