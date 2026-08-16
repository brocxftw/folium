# Production readiness

Audit only. **Not ready** for “download compose + pull images, no git clone”.

Intended future experience (not implemented):

```text
download docker-compose.yml
download .env.example
configure
docker compose up -d
```

---

## Findings

### Critical

| Finding | Why it blocks public image-only deploy |
|---------|----------------------------------------|
| No published Folium images / registry workflow | Users must `build:` from a git checkout |
| Default secrets in examples and Compose (`changeme`, Postgres `folium/folium`) | Unsafe if copied blindly |

### High

| Finding | Notes |
|---------|--------|
| Compose `build:` for api/worker/web | Clone + Docker build required |
| `FOLIUM_VERSION` not injected in Compose | Containers report `0.1.0` without git |
| Frontend CSRF cookie name hard-coded | Config drift |
| `group_add: 10000` in default Compose | Site-specific CIFS assumption |
| Postgres credentials not parameterized | Cannot rotate via `.env` alone |
| No backup/restore automation or documented upgrade story beyond rebuild | Operators must invent it |
| CI `ruff check \|\| true` and first `alembic \|\| true` | Quality gate incomplete |
| Worker has no healthcheck | Orchestrators cannot know it died |

### Medium

| Finding | Notes |
|---------|--------|
| Host port `5433` published by default | Attack surface |
| `/export` unused for document export | Mount without feature |
| Debug compose file in repo | Easy to misuse in prod |
| Registration default `true` | May be unwanted on internet exposure |
| Secure cookies only if origin is https **and** env not development | Easy to run HTTP in “production” env |
| No image multi-arch matrix in CI | ARM NAS users **Unknown** until tested |
| Ask conversations vs docs lag | Operational confusion, not deploy |

### Low

| Finding | Notes |
|---------|--------|
| Empty `scripts/` | Noise |
| `pyproject` “AI-native” blurb | Messaging |
| Preview files without HTTP route | Harmless |

---

## Grouped for a future public release

### Must fix before public release

- Publish versioned images **or** clearly remain “source-built only”
- Remove/default-safe secrets; parameterize Postgres password
- Set `FOLIUM_VERSION` at image build
- Stop treating CI lint as optional
- Document backup: `folium_pgdata` + `/documents` + `.env`

### Strongly recommended before public release

- Drop or document `group_add: 10000`
- Worker healthcheck or API-exposed heartbeat
- Do not publish DB port in production compose example
- CSRF cookie name shared config
- Disable registration by default in production example
- Upgrade notes (migrations already run on api start — good)

### Nice to have later

- GHCR attestation, SBOM
- Document export using `/export`
- Multi-arch builds
- Standalone compose without git

---

## Can an external user…?

| Question | Today |
|----------|--------|
| 1. Obtain Folium | Yes, by **git clone** (not image pull) |
| 2. Configure it | Yes, `.env` + binds; some Compose values not overridable |
| 3. Start it | Yes, `docker compose build && up` if Docker/build works |
| 4. Retain data across upgrades | **Partial:** volumes persist; must rebuild images; migrations on api start |
| 5. Update it | `git pull` + rebuild; no image tags |
| 6. Diagnose failed startup | Logs + `/health`; worker death is easy to miss |
| 7. Use without AI | **Yes** |
| 8. Back up persistent data | Manual: volume + binds; no first-class tool |

---

## Dependency and licence notes (not legal advice)

Sources: package metadata / upstream licence files commonly published with these projects. **Maintainer review recommended** before any public distribution.

| Dependency | Purpose | Detected licence | Source of licence info | Review? |
|------------|---------|------------------|------------------------|---------|
| FastAPI / Starlette / Pydantic | API | MIT | PyPI classifiers / upstream LICENSE | Routine |
| Uvicorn | Server | BSD-3 | Upstream | Routine |
| SQLAlchemy / Alembic / asyncpg / psycopg | DB | MIT | Upstream | Routine |
| pgvector (extension + python) | Vectors | PostgreSQL Licence | Upstream README | Routine |
| PostgreSQL | Database | PostgreSQL Licence | postgresql.org | Routine |
| Argon2-cffi / cryptography | Auth/secrets | MIT / Apache-2.0+BSD | Upstream | Routine |
| httpx | AI HTTP | BSD-3 | Upstream | Routine |
| PyMuPDF (`pymupdf`) | PDF text/render | **AGPL-3.0** (typical PyPI) | PyPI / Artifex terms | **Yes — copyleft** |
| python-docx | DOCX | MIT | Upstream | Routine |
| Pillow | Images | HPND-derived | Upstream | Routine |
| PaddleOCR / PaddlePaddle | OCR | Apache-2.0 (typical) | Paddle GitHub LICENSE | Confirm CPU wheel terms |
| tiktoken | Token counts | MIT | Upstream | Routine |
| bleach | HTML sanitize | Apache-2.0 | Upstream | Routine |
| React / Vite / TanStack Query | SPA | MIT | npm | Routine |
| Tailwind CSS | CSS | MIT | npm | Routine |
| Radix UI | Primitives | MIT | npm | Routine |
| pdfjs-dist | PDF viewer | Apache-2.0 | Mozilla | Routine |
| nginx | `web` image | BSD-2-like | nginx.org | Routine |
| Node / Python base images | Runtime | Various | Image OS | Routine |

Folium’s project licence is **GNU AGPL v3.0** (`LICENSE` at the repository root), chosen to align with PyMuPDF’s typical AGPL-3.0 terms. That does **not** replace review of other dependency licences (Paddle wheels, base images). This is not legal advice.

---

## Overall state

```text
Not ready
```

**Justification:** Folium runs as a **source-built Compose homelab** with real DMS functionality and optional AI, but it cannot be obtained as versioned images and ships insecure default database credentials in Compose. Data *can* persist if operators back up the volume and binds, but that path is undocumented as a product feature. AI-down does not take the app offline — that part *is* ready. The project is licensed under AGPL-3.0.

Classification is **Not ready** for the stated public image-only bar. For a technical operator who clones the repo, the stack is **usable with caveats** (secrets, UID 1000, first-boot admin, OCR model download).
