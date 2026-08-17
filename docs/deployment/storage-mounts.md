# Storage mounts

Folium does **not** mount NFS. Mount on the host, then bind-mount.

## Table

| Mount (Compose) | Container path | Purpose | Recommended backing |
|-----------------|----------------|---------|---------------------|
| `${FOLIUM_DOCUMENTS_HOST:-./data/documents}` | `/documents` | Originals, thumbnails, previews, avatars | Local disk or **host-mounted** NFS |
| `${FOLIUM_CONSUME_HOST:-./data/consume}` | `/consume` | Watched ingest | Same as documents or dedicated share |
| `${FOLIUM_EXPORT_HOST:-./data/export}` | `/export` | Reserved export dir (health only today) | Same family as documents |
| `${FOLIUM_BACKUPS_HOST:-./data/backups}` | `/backups` | Folium backup bundles (`.folium`) | Local disk or **host-mounted** NFS/CIFS |
| `${FOLIUM_PADDLE_CACHE_HOST:-./data/paddleocr}` | `/app/.paddleocr` | OCR model cache | Local disk (not required on NFS) |
| `folium_pgdata` | `/var/lib/postgresql/data` | Database | **Local Docker volume only — not NFS** |

UID **1000** must be able to write document/consume/export binds (Compose `user: 1000:1000`). Public Compose does not add extra GIDs; use `docker-compose.override.yml` if a share is `0770` for a host group.

## After container destroy

Named volume + host binds persist. Recreate with `docker compose up -d` (without `-v`).

`docker compose down` keeps data. `docker compose down -v` **deletes** `folium_pgdata`.

See [backup](backup.md).
