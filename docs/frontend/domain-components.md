# Domain components

Significant product surfaces only. Generic buttons/inputs are not documented here.

| Component | Responsibility | Relates to |
|-----------|----------------|------------|
| **Document viewer** (`DocumentViewer`, modal) | On-demand PDF/image/text via pdf.js / download URL; page navigation | Inspector, citation clicks, Ask panel |
| **Explorer sidebar** | Quick Access (all / recent / unprocessed / Inbox link) + folder tree + tags | Documents URL state |
| **Inspector** | Overview (readiness, flags, summary, job history), Metadata, OCR text | Selected/open document |
| **AI drawer** (`AIChatDrawer` / `AIChatPanel`) | Scoped **single-turn** workspace Ask with citations | `/api/ask`; not the document thread |
| **Document Ask panel** | **Multi-turn** thread for one document | `/api/documents/{id}/ask` + conversation endpoints |
| **Inbox review** | Hero, table/cards, AI vs manual filing, activity | Process gate |
| **Search results** | Grouped hits, snippets, mode/coverage | Evidence search |
| **Bulk toolbar** | Multi-select Move, Tag, Ask, Trash, archive | `POST /api/documents/bulk` |
| **Upload dropzone** | Files and folder trees; duplicate skip/error | `upload` + `relative_path` |
| **Jobs list** | Queue visibility | Worker |
| **Folder tree** | Create/rename/trash folders | Folder APIs |
| **Retrieval readiness badge** | UI-derived keyword/semantic/inbox stages | Flags, not a DB enum |

Viewer stays a modal over library state (query params `doc`, `viewerPage`) rather than a dedicated `/documents/:id` page (legacy paths redirect).
