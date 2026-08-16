# Upgrades and rollback

## Update to a newer release (pinned)

Edit `.env`:

```text
FOLIUM_VERSION=0.2.0
```

Then:

```bash
docker compose pull
docker compose up -d
```

The API container runs `alembic upgrade head` before serving traffic. The worker waits until the API is healthy, then processes jobs against the migrated schema.

`docker compose pull` + `up -d` does **not** remove the Postgres volume or host document binds.

## Update using `latest`

If `FOLIUM_VERSION=latest`, `docker compose pull` fetches the most recent **stable tag** published by the release workflow (not arbitrary `main` commits).

Prefer pinning `FOLIUM_VERSION` so the Compose file, `.env`, and images stay aligned.

## What is not an upgrade path

- `git pull` and `docker compose build` are for **contributors**, not operators.
- Do not use `docker compose down -v` during an upgrade.

## Rollback

You may point `FOLIUM_VERSION` at an older image tag and `docker compose pull && docker compose up -d`.

**Application image rollback does not roll back the database.** Alembic migrations are forward-only in this project. If version B migrated the schema, returning to image A can fail or corrupt data if A cannot read the new schema.

Safe rollback is limited to:

- configuration (`.env`) that version A understands
- images **before** a schema-changing release, or
- restoring a **backup taken before** the upgrade ([backup](backup.md))

Do not assume Folium supports mixed application/schema versions.
