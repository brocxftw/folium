# Storage architecture

Physical files are **content-addressed**. **Logical folders** are database metadata. Moving a document in the UI **does not move the blob**.

---

## Layout inside `DOCUMENTS_PATH` (`/documents`)

```text
/documents/
├── originals/     {checksum[:2]}/{checksum}.{ext}
├── thumbnails/    derived keys
├── previews/      derived keys (JPEG; no public download route)
└── avatars/       user avatars
```

Storage key example: `4f/4f2938….pdf`. Writes are atomic (temp file + replace). If the destination exists with the **same** checksum, ingest reuses the blob. Collision with **different** content is rejected.

Thumbnails are served at `GET /api/documents/{id}/thumbnail`. Originals at `GET /api/documents/{id}/download` (inline). Preview JPEGs may exist on disk without a dedicated HTTP endpoint (**Confirmed**).

---

## Other mounts

| Path | Purpose |
|------|---------|
| `/consume` | Drop zone; worker ingests then deletes source file |
| `/export` | Mount exists; layout + health probe only. **No document export writer** in application code |

PaddleOCR models: image sets `PADDLE_PDX_CACHE_HOME=/app/.paddleocr`, Compose bind `FOLIUM_PADDLE_CACHE_HOST` (default `./data/paddleocr`).

---

## Docker persistence

| Data | Backing | Survives container recreate? |
|------|---------|------------------------------|
| PostgreSQL | Named volume `folium_pgdata` | Yes (volume remains) |
| Documents / consume / export | Bind mounts (`FOLIUM_*_HOST` or `./data/*`) | Yes (host paths) |
| Paddle cache | Bind mount | Yes |
| Application image/code | Image layers | Replaced on rebuild |

**Confirmed:** destroying **containers** keeps `folium_pgdata` and host binds. `docker compose down -v` deletes the Postgres volume.

**Never** put `folium_pgdata` on NFS (Compose comment + product rule). Document binds **may** be host-mounted NFS.

---

## NFS model

**Confirmed:** Folium never calls `mount`. The operator mounts NFS (or local disks) on the **Docker host**, then bind-mounts into containers.

If NFS is stale: `GET /health/storage` reports `degraded` or `unavailable`. Writes that need documents storage raise `StorageUnavailableError`. PostgreSQL metadata is unchanged.

`FOLIUM_DOCUMENTS_HOST_SOURCE` is **display metadata** for Settings → System; it is not inferred from the mount.

---

## Checksums and duplicates

SHA-256 of file bytes. Unique per owner among non-duplicate policy. Consume uses skip-on-duplicate and removes the dropped file.

---

## Deletion / purge

`permanently_delete` removes DB rows and derived files. The original blob is removed only if no other document shares `storage_key`.

---

## Compose site notes

`group_add: ["10000"]` is present so the container can write certain CIFS shares. That GID is **deployment-specific**, not a Folium protocol.
