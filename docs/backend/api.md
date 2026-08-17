# API

Capability-oriented map of the FastAPI surface. Live schema: **`/docs`** and **`/openapi.json`** (also proxied from `web`). This page does not replace OpenAPI.

Mutating routes generally depend on `SafeSession` (CSRF). GETs use `CurrentUser` where authenticated.

---

## Authentication

| Action | Endpoint |
|--------|----------|
| Login / logout / me | `POST /api/auth/login`, `logout`, `GET /api/auth/me` |
| Register | `POST /api/auth/register` (if `ALLOW_REGISTRATION`) |
| Profile, password, avatar, sessions | `/api/auth/me*` |
| Forgot / reset password | `/api/auth/forgot-password`, `/api/auth/reset-password*` |

**Flow:** login → Set-Cookie session + CSRF → SPA stores CSRF from JSON/`folium_csrf` cookie → mutations send `X-CSRF-Token`.

---

## Documents and Inbox / Process

```text
Upload → POST /api/documents/upload → ingest_bytes → jobs
List/browse → GET /api/documents
Process → POST /api/documents/process → process_inbox_documents → INDEXING job
```

Also: metadata PATCH, move, trash/restore, bulk, retry preflight/OCR/embeddings/suggestions, download, thumbnail, page content, remove-from-queue.

Inbox metrics: `GET /api/inbox/overview`, `GET /api/inbox/activity`.

---

## Folders, tags, types, correspondents

CRUD under `/api/folders`, `/api/tags`, `/api/document-types`, `/api/correspondents`. Folder delete requires a strategy (move to parent, Inbox, or trash contents) — see OpenAPI body.

---

## Search vs Ask

| User intent | Endpoint | Side effects |
|-------------|----------|----------------|
| Browse (empty q) | `GET /api/documents` | None |
| Evidence search | `POST /api/search` | May **embed the query** if semantic/hybrid and provider configured |
| Workspace Ask | `POST /api/ask` | Chat completion; no conversation rows |
| Document Ask | `POST /api/documents/{id}/ask` | Chat + persist `ask_conversations` |
| Load/clear thread | `GET/DELETE .../ask/conversation`, `POST .../ask/conversation/new` | |

**Search retrieves. Ask generates.** Search does not call the chat model.

---

## AI settings (admin)

`/api/ai/providers`, `/assignments`, `/policy`, `/capabilities`, `/health`, `/usage`, `/suggestions/{id}/accept|reject`.

---

## Jobs, trash, users, system

- Jobs: `GET /api/jobs`, cancel
- Trash: count, purge, empty
- Users/invites/password-resets: `/api/users/*` (admin)
- System: `/api/system/summary|storage|diagnostics`
- Logs: `/api/logs`, `/export`, `DELETE`
- Library stats: `/api/library/overview`, reset
- About: `/api/about`
- Backup & restore (admin): `/api/backups*`
- First-run bootstrap (uninitialised only): `/api/bootstrap*`
- Health (unauthenticated): `/health`, `/health/database`, `/health/storage`

---

## Example: Process from Inbox

```text
Inbox UI Process
  → POST /api/documents/process { document_ids }
  → folium.services.documents.process_inbox_documents
  → folders.ensure_folder_path (pending path)
  → documents.inbox = false
  → jobs.enqueue INDEXING
  → worker process_indexing
```
