# Jobs and workers

Expensive ingestion and enrichment run **asynchronously**. The queue is **PostgreSQL** (`jobs` table), not Redis. The `worker` service claims rows with `FOR UPDATE SKIP LOCKED`.

---

## Job lifecycle

```text
queued → running → completed
                 → failed     (after max_retries)
                 → cancelled
         ↺ queued             (retry; optional available_at delay)
```

- **Claim:** highest priority (lower number first), then oldest `created_at`, if `available_at` is null or past.
- **Lock:** `locked_by` = `{hostname}-{pid}`; `locked_at` heartbeat (`JOB_LOCK_HEARTBEAT_SECONDS`).
- **Retries:** default `max_retries=3`. Transient AI errors use backoff via `available_at`. Retry slightly worsens priority.
- **Cancellation:** API `POST /api/jobs/{id}/cancel`. If cancelled mid-run, `complete_job` preserves `cancelled` (cooperative).
- **Recovery:** On worker start, **all** `RUNNING` jobs are requeued. Loop also requeues running jobs with stale locks (`JOB_STALE_RUNNING_SECONDS`, default 600).
- **Trashed documents:** jobs skipped at claim; cancelled on worker start.

---

## Concurrency

`JOB_CONCURRENCY` (default 1) is an asyncio semaphore **inside one worker process**.

OCR takes an **exclusive gate**: while a Paddle OCR job (PDF OCR or image extract) is running, the worker does not claim additional jobs. This prevents indexing/backup peaks from stacking on OCR RAM even if concurrency is raised above 1.

PaddleOCR runs in a **short-lived subprocess** by default (`OCR_IN_PROCESS=false`). The parent worker stays lean; when the child exits, the kernel reclaims model RAM. PDF pages are rendered at `OCR_DPI` (default 150) and streamed to the parent as NDJSON page events for incremental persistence.

**Inbox preflight gate:** extract/OCR/thumbnail/metadata_suggestion for still-preparing Inbox docs are claimed for **one document at a time** (oldest `added_date`). Ready Inbox docs (e.g. suggestion retry) use normal ordering.

---

## Job types

| Job type | Trigger | Input | Work performed | Output | Failure behaviour |
|----------|---------|-------|----------------|--------|-------------------|
| `text_extraction` | Ingest | Original blob | Native text / image OCR; pages + FTS | `text_extracted`, pages | Hard-fail preflight (`processing_status=failed`) |
| `ocr` | Thin PDF after extract (if OCR on) | PDF pages | PaddleOCR PP-OCRv6 CPU | Page text, `ocr_completed` | Hard-fail preflight |
| `thumbnail` | Ingest | Original | Render thumbnail + preview JPEG | `thumbnail_key`, `preview_key` | Logged skip; does not fail document |
| `metadata_suggestion` | End of extract/OCR if auto_tagging | Sampled text + folder/tag candidates | Chat-like **indexing role** model | `ai_suggestions` rows | **Soft-fail**; Inbox can still become ready |
| `indexing` | Process (Inbox) or post-preflight (library docs) | Page text | Chunking; **no embeddings** | `document_chunks`, `document_indexed` | Job fail; document not indexed |
| `embedding` | After indexing if embedding provider healthy | Chunk text | Vectors + padding | `has_embeddings`, chunk statuses | Partial embeddings possible; `embedding_error` |
| `summary` | After indexing if `auto_enrichment` | Document text | Direct summary (not RAG) | `ai_summary` | **Soft-fail**; filing unchanged |
| `classification` | — | — | **No handler** | skip | **Legacy** enum value |
| `backup` | Manual or schedule | Postgres + originals | Write `.folium` bundle | `backup_records` | Job fail; no retention |
| `backup_verify` | Settings Verify | Existing bundle | Checksums + compatibility | verification status | Record marked corrupted/failed |

### Indexing ≠ Embedding ≠ AI “indexing” role

| Name | What it is |
|------|------------|
| `JobType.INDEXING` | Split pages into chunks for retrieval |
| `JobType.EMBEDDING` | Vectorise those chunks |
| `AIWorkloadRole.INDEXING` | Assigned **chat** model used for filing suggestions and summaries |

---

## Worker side loops (not jobs)

| Loop | Purpose |
|------|---------|
| Consume poll | Ingest stable files from `/consume` |
| Trash purge | Hard-delete past `TRASH_RETENTION_DAYS` |
| AI health probe | Update provider `last_probe_*`; never blocks job claiming |

---

## API surface

- `GET /api/jobs` — list (owner-scoped via document join)
- `GET /api/jobs/{id}`
- `POST /api/jobs/{id}/cancel`

There is no separate “worker health” HTTP *API under `/api`*. Unauthenticated `GET /health/worker` reads `worker_heartbeat`. Compose healthchecks the worker container with `python -m folium.workers.healthcheck`.
