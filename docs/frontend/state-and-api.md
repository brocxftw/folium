# State and API

## Server state

TanStack Query. Keys centralized in `queryKeys` (`hooks.ts`). Mutations invalidate related keys (documents, folders, inbox, suggestions, jobs, session).

Polling: Inbox/Jobs/readiness use refetch intervals where documents still need processing (`documentNeedsProcessingPoll`).

## Local and URL state

Documents: parse/serialize `URLSearchParams` (view, folder, q, sort, filters). Selection is in-memory (`useDocumentSelectionModel`).

Ask drawer: local React state for last answer (workspace). Document Ask hydrates from `useAskConversation`.

## Persisted preferences

| Key | Value |
|-----|--------|
| `folium.sidebarOpen` | boolean |
| `folium.documents.layoutMode` | `list` \| `grid` |
| `folium.documents.recentsCollapsed` | boolean |

## Authentication

Session query; 401 handling on the client. CSRF token from login JSON and/or readable `folium_csrf` cookie.

## Errors and loading

`ApiError` with status helpers. Workspaces show loading/empty/error copy per list (Inbox, Documents, Search). Ask surfaces privacy/`confirm_remote` errors from API `detail`.

## Cache invalidation

Hooks typically `invalidateQueries` for `documents`, `document`, `inbox`, `search`, `jobs`, `folders`, `tags` after mutations. Not a normalized cache — refetch by key.
