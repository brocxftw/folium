# Backup

Folium does not ship a backup daemon. Operators copy three things.

## Must back up

| Item | What it is | How |
|------|------------|-----|
| PostgreSQL | Metadata, FTS, jobs, users, optional embeddings | Named Docker volume `folium_pgdata` |
| `/documents` | Content-addressed originals, thumbnails, previews, avatars | Host bind `FOLIUM_DOCUMENTS_HOST` |
| `.env` | Secrets, DB password, origin, version pin | File next to Compose |

Example while the stack is **stopped** or after a DB dump:

```bash
docker compose stop
docker run --rm -v folium_pgdata:/var/lib/postgresql/data -v "$(pwd)/backup:/backup" \
  alpine tar czf /backup/folium-pgdata.tar.gz -C /var/lib/postgresql/data .
tar czf backup/documents.tar.gz -C "$(dirname "${FOLIUM_DOCUMENTS_HOST:-./data/documents}")" \
  "$(basename "${FOLIUM_DOCUMENTS_HOST:-./data/documents}")"
cp .env backup/env
docker compose start
```

A logical dump (stack up) is also valid:

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup/folium.sql
```

Use the same user/database names as `.env`.

## Also consider

| Path | Role | If omitted |
|------|------|------------|
| `/consume` | Drop folder for ingest | In-flight files only; not the library |
| `/export` | Reserved export directory | Unused for document export today |
| PaddleOCR cache | Downloaded OCR models | First OCR after restore re-downloads |

## Compose down vs wipe

```bash
docker compose down      # keeps named volume and host binds
docker compose down -v   # DELETES folium_pgdata (Postgres)
```

Recreating containers (`up -d` after `down`) does not delete documents or the database volume.
