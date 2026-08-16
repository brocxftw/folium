# Services

Domain services sit between HTTP and the database. Prefer these boundaries over listing every helper module.

| Domain | Responsibility |
|--------|----------------|
| **Document lifecycle** | Ingest, duplicates, Inbox status, Process, trash/restore/purge, metadata, retries, artefact invalidation (`services/documents.py`) |
| **Folders** | System folders (root/inbox/trash), path cache, descendants, delete strategies (`services/folders.py`) |
| **Tags / named entities** | Tags, types, correspondents (`services/tags.py` + API) |
| **Jobs** | Enqueue, claim, complete/fail/cancel, stale requeue, Inbox preflight gate (`services/jobs.py`) |
| **Storage** | Content-addressed I/O, health probes (`storage/service.py`) |
| **Chunking** | Token-safe page → chunk drafts (`services/chunking.py`) |
| **Embedding pipeline** | Batch/resume/split oversized inputs (`services/embedding_pipeline.py`) |
| **Quotas** | Storage + monthly AI request caps (`services/quotas.py`) |
| **Users** | Admin password, consume owner resolution (`services/users.py`) |
| **Ask conversations** | One thread per owner+document; history budget; citation rewrite (`services/ask_conversations.py`) |
| **Inbox / library stats** | Overview metrics and increment-only counters |
| **System / logs** | Diagnostics and retained application logs |

OCR extraction is **not** a “service” package; it is `folium.ocr` invoked from the worker.

Search algorithms live in `folium.search` (used by API and Ask scope resolution). RAG orchestration lives in `folium.ai.rag` (used by Ask endpoints).
