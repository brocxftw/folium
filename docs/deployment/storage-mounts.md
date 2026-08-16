# Storage mounts

Folium does **not** mount NFS. Mount on the host, then bind-mount.

## Table

| Mount (Compose) | Container path | Purpose | Recommended backing |
|-----------------|----------------|---------|---------------------|
| `${FOLIUM_DOCUMENTS_HOST:-./data/documents}` | `/documents` | Originals, thumbnails, previews, avatars | Local disk or **host-mounted** NFS |
| `${FOLIUM_CONSUME_HOST:-./data/consume}` | `/consume` | Watched ingest | Same as documents or dedicated share |
| `${FOLIUM_EXPORT_HOST:-./data/export}` | `/export` | Reserved export dir (health only today) | Same family as documents |
| `${FOLIUM_PADDLE_CACHE_HOST:-./data/paddleocr}` | `/app/.paddleocr` | OCR model cache | Local disk (not required on NFS) |
| `folium_pgdata` | `/var/lib/postgresql/data` | Database | **Local Docker volume only — not NFS** |

UID **1000** must be able to write document/consume/export binds (Compose `user: 1000:1000`). Extra GID 10000 is for a specific CIFS setup; other hosts may ignore or need adjustment.

## After container destroy

Named volume + host binds persist. Recreate with `docker compose up -d` (without `-v`).
