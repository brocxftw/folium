# Folium AI evaluation harness (Phase 1 scaffold)

Lightweight, reproducible checks for filing-context sampling and Ask quality.
Grow the golden set toward 30–50 documents over time.

## What this covers today

- **Filing sample coverage**: long documents include beginning + ending markers (and ideally middle), proving representative sampling beats naive prefix truncation.
- **Metric stubs** for later live runs: filing usefulness, Recall@K, citation correctness, insufficient-evidence precision/recall.

## Run

```bash
cd backend
uv run pytest tests/eval -q
```

Optional live AI (uses configured providers; not required for scaffold):

```bash
FOLIUM_LIVE_AI=1 uv run pytest tests/eval -q -k live
```

## Golden fixtures

Synthetic long documents live under `fixtures/`. Each JSON entry includes:

- `id`, `title`, `filename`
- `pages`: ordered page texts with unique markers
- `expect_sample_markers`: strings that must appear in the filing sample

Add invoices, contracts, OCR-like noise, and short docs as the set grows.
