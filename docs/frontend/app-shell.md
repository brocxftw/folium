# App shell

Global chrome: dark sidebar, main canvas, account/settings, version from `GET /health`.

**Confirmed navigation (`AppShell` `NAV_ITEMS`):**

| Route | Label |
|-------|-------|
| `/inbox` | Inbox |
| `/documents` | Documents |
| `/search` | Search |
| `/ask` | Ask |
| `/jobs` | Jobs |
| `/trash` | Trash |

Settings is a footer/account control → `/settings/profile`, not a primary nav item. Version string shows when health returns `version`.

**Not present:** Shared with me, Activity feed, Starred (**planned** in ubiquitous language only).

Sidebar width persisted as `folium.sidebarOpen`. Collapsed mode is icon-only with tooltips.

On Documents, the shell does not duplicate the folder tree; the explorer lives inside the workspace.

`SidebarAiPipeline` shows compact AI/provider status in the sidebar (**Confirmed** component).

---

## Guest vs auth

`AuthGuard` / `GuestGuard`: unauthenticated users hitting app routes go to login. Session from `GET /api/auth/me`.
