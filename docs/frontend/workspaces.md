# Workspaces

User-facing surfaces by purpose. Routes from `App.tsx`.

| Workspace | Purpose | Key actions | APIs | Important state |
|-----------|---------|-------------|------|-----------------|
| **Inbox** `/inbox` | Review ingested docs; Process into library | Upload, set folder/tags, accept suggestions, Process, retry OCR/preflight, remove from queue | `/api/inbox/*`, `/api/documents*`, `/api/ai/suggestions*` | Queue vs activity tabs; preparing phases; session rejections |
| **Documents** `/documents` | Library: browse, organise, inspect, search, Ask | Folder tree, list/grid, upload, bulk move/tag/trash/archive, viewer, inspector, AI drawer | `/api/documents`, `/api/folders`, `/api/search`, `/api/ask` | URL library state; selection; layoutMode; viewer `doc` query |
| **Search** `/search` | Standalone evidence search | Query, mode, folder/tag filters | `POST /api/search` | `q`, `mode` query params |
| **Ask** `/ask` | Standalone Ask entry | Opens AI drawer (library or search scope from `q`) | `POST /api/ask` | Local drawer; **no** conversation persistence |
| **Jobs** `/jobs` | Background work visibility | List, cancel | `/api/jobs*` | Status filter |
| **Trash** `/trash` | Soft-deleted items | Restore, purge, empty | `/api/trash*`, document restore/delete | Retention copy from settings |
| **Settings** `/settings/*` | Profile, AI, library stats, backup, system, logs, about | See below | `/api/auth/me`, `/api/ai/*`, `/api/library/*`, `/api/backups*`, `/api/system/*`, `/api/logs*`, `/api/users*`, `/api/about` | Nested nav; admin guards |

## Settings sections

| Section | Who | Notes |
|---------|-----|-------|
| Profile | All | Password, avatar, sessions; Users nested at `profile/users` (admin) |
| Artificial Intelligence | Admin | Usage; models (assignments + providers); advanced (policy + performance) |
| Library | All | Stats / health-ish metrics; reset counters |
| Backup & Restore | Admin | Manual/scheduled backups, history, restore |
| System | Admin | Process/container-visible facts, storage paths |
| Logs | Admin | Filter, CSV export, clear |
| About | All | Version and optional repo links |

Legacy redirects: `ai-providers`, `ai-policy`, `storage`, `users` → new paths.

---

## Documents vs Search vs Ask

Documents is the **primary** find/organise/understand surface. `/search` and `/ask` remain so deep-links and older habits still work. Ask from Documents preserves folder/selection/search snapshot in the drawer.
