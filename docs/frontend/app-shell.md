# App shell

Global chrome: dark **top navbar** (72px), white main canvas, account/settings, version from `GET /health`.

**Confirmed navigation (`AppShell` `NAV_ITEMS`):**

| Route | Label |
|-------|-------|
| `/inbox` | Inbox |
| `/documents` | Library |
| `/trash` | Trash |

Settings is a gear icon on the right of the navbar → `/settings`, not a primary nav item. Version string shows under the wordmark when health returns `version`.

**Not present as primary nav:** Ask, Search, Jobs (routes still exist for deep links and in-page actions). Shared with me, Activity feed, Starred (**planned** in ubiquitous language only).

The Documents explorer (Quick Access, Folders, Tags) lives in the **page body**, not the global shell.

`AiStatusPill` shows compact AI status in the navbar. Hover reveals OCR / Indexing / Embedding / Chat details; click opens AI settings (admin) or About (non-admin).

Account avatar opens a menu with Log out.

---

## Guest vs auth

`AuthGuard` / `GuestGuard`: unauthenticated users hitting app routes go to login. Session from `GET /api/auth/me`.
