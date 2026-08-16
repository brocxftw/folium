# Testing

## Backend

```bash
cd backend
.venv/bin/pytest -q
# Makefile: make backend-test
```

- **Unit:** `tests/unit/` — chunking, privacy gate, jobs requeue, RAG helpers, OCR mocks, etc.
- **Integration:** `tests/integration/` — HTTP + Postgres (`folium_test` in CI). Requires pgvector Postgres (CI service on 5433).
- **Eval:** `tests/eval/` — filing sample coverage / histograms; not a full quality eval harness.
- Marker `live_ai`: optional real OpenAI-compatible endpoint (`FOLIUM_LIVE_AI=1`).

CI installs `.[dev]` **without** `ocr`; Paddle is mocked.

Ruff/mypy configured in `pyproject.toml`. CI runs `ruff check || true` (**not gating**).

## Frontend

```bash
cd frontend
npm test              # vitest run
npm run build         # tsc -b && vite build
```

Mostly unit tests for Inbox helpers, readiness, citations, a few component tests. **No Playwright/e2e** in-repo.

## Compose

```bash
cp .env.example .env
docker compose config
```

CI does not `docker compose build` the app images.

## Gaps (Confirmed)

- No end-to-end browser tests
- No migration-only test job beyond `alembic upgrade` in pytest setup
- Lint not required to pass in CI
- OCR extra untested in CI against real Paddle
