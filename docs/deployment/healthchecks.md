# Healthchecks

## Container checks (Compose)

| Service | Test | Notes |
|---------|------|-------|
| `db` | `pg_isready -U folium -d folium` | Required for api/worker start |
| `api` | `curl -sf http://127.0.0.1:8000/health` | Does **not** check DB, storage, worker, or AI |
| `web` | `wget -qO- http://127.0.0.1/` | Static nginx |
| `worker` | **None** | Heartbeat in `app_settings.worker_heartbeat` only |

## Application endpoints

| Path | Auth | Checks |
|------|------|--------|
| `GET /health` | No | Process up; `version` |
| `GET /health/database` | No | `SELECT 1` |
| `GET /health/storage` | No | Writability of documents/consume/export |
| `GET /api/ai/health` | Yes | Assigned provider probes |

**Confirmed:** an unavailable AI provider does **not** fail `GET /health` or the api Compose healthcheck. Folium remains a document manager when AI is down.

Storage `status`: `ok` \| `degraded` (documents OK, consume/export not) \| `unavailable` (documents not writable).
