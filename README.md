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

**Current model:** clone this repository and **build images locally**. Pre-built registry images are not published.

```bash
cp .env.example .env
# set FOLIUM_SECRET_KEY and FOLIUM_ENCRYPTION_KEY

mkdir -p data/documents data/consume data/export
# containers use UID 1000
sudo chown -R 1000:1000 data/documents data/consume data/export

docker compose build && docker compose up -d
```

UI: http://localhost:8080 — bootstrap admin from `.env` **on first start only**.  
OpenAPI: http://localhost:8000/docs

Locked out of every admin: `docker compose exec -it api folium reset-admin-password`

Deployment: [`docs/deployment/`](docs/deployment/overview.md)

## Configuration

Copy `.env.example`. Compose overrides database URLs to the `db` service. AI policy env vars **seed** the database once; later changes are in Settings.

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
make test          # backend pytest + frontend vitest/build
```

## Repository structure

```text
backend/     FastAPI, worker, Alembic, tests
frontend/    React SPA
docker/      Dockerfiles, nginx
docs/        Architecture and operations
```

## Current limitations / project status

- Source-built Compose; not an image-only install ([`production-readiness.md`](docs/deployment/production-readiness.md) — **Not ready** for public image distribution)
- `/export` is mounted but unused for document export
- No SMTP; password reset is admin-approved
- Default Compose publishes Postgres on host `5433` and uses a fixed DB password
- No browser end-to-end test suite
- `classification` job type exists without a handler

## Contributing

[`docs/development/contributing.md`](docs/development/contributing.md)

## Licence

Folium is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This matches the copyleft terms of PyMuPDF, which Folium uses for PDF text extraction and rendering. See also the dependency notes in [`docs/deployment/production-readiness.md`](docs/deployment/production-readiness.md). This is not legal advice.

## Acknowledgements

Built with FastAPI, PostgreSQL, [pgvector](https://github.com/pgvector/pgvector), React, PaddleOCR, PyMuPDF, and nginx. Inspired by the operational shape of self-hosted document managers such as Paperless-ngx, without being a fork of that project.
