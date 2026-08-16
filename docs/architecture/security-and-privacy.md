# Security and privacy

High-level description of **implemented** controls. This is not a penetration test and not a compliance certification.

Wording “Folium enforces…” is used only where application code implements the check.

---

## Authentication and sessions

- Passwords hashed with **Argon2** (`folium.auth.passwords`).
- Session token stored **hashed** in `sessions`; raw token in HttpOnly cookie (`SESSION_COOKIE_NAME`, default `folium_session`).
- CSRF: double-submit style — cookie `CSRF_COOKIE_NAME` (not HttpOnly) plus header `X-CSRF-Token` required on mutating API calls (`require_auth_csrf`).
- `SameSite=Lax`. `Secure` flag when `FOLIUM_ENV` is not dev **and** `FRONTEND_ORIGIN` is `https://`.
- CORS: single allowed origin `FRONTEND_ORIGIN` with credentials.
- Bootstrap admin (`FOLIUM_ADMIN_*`) is created **only when the users table is empty**. Env password is not reapplied on restart.
- Password recovery is **admin-approved** (no SMTP). CLI: `folium reset-admin-password`.

**Configuration-dependent gap:** frontend CSRF cookie reader hard-codes `folium_csrf`. Changing `CSRF_COOKIE_NAME` without a matching frontend change will break mutations.

---

## Access control

- Almost all library APIs require a valid session (`CurrentUser`).
- Documents, folders, tags, jobs (via document join), Ask scopes filter by `owner_id`.
- Admin-only: user management, invites, AI provider/policy writes, system diagnostics, log clear, etc. (`require_admin`).
- File download/thumbnail goes through document ownership checks, then path confinement in `StorageService._confine`.

There is **no** document ACL / sharing.

---

## Uploads and storage

- MIME allow-list (`ALLOWED_MIME_TYPES`) and size cap.
- Path traversal rejected on storage keys.
- Consume files must resolve under `CONSUME_PATH`.

---

## Quotas

- `storage_quota_bytes` — ingest rejected when exceeded (`null` = unlimited).
- `ai_monthly_request_quota` — counted AI operations per calendar month.

---

## Secrets

- `FOLIUM_SECRET_KEY` — sessions/tokens (treat as secret).
- `FOLIUM_ENCRYPTION_KEY` — Fernet key derived via SHA-256; encrypts provider API keys at rest (`encrypted_api_key`). API returns **masked** secrets.
- Compose still ships default Postgres password `folium` in `docker-compose.yml` (**not** read from `.env` for the `db` service).

---

## Privacy modes (application-enforced)

`PrivacyGate` runs before sending **document content** to a provider:

| Mode | Behaviour |
|------|-----------|
| `local_only` | Remote providers rejected for embeddings / Q&A / vision |
| `private_hybrid` | Remote allowed only if the corresponding `allow_remote_*` flag is true |
| `standard` | Subject to `block_remote_ai` and `allow_remote_*` |

`is_local` on the provider is the switch Folium trusts for “local vs remote”. Mis-marking a cloud endpoint as local **bypasses** local-only (**Inference:** operator must set this honestly).

`warn_before_remote`: Ask endpoints require `confirm_remote=true` when the chat provider is not local.

Provider fields `no_training` and `zero_retention` are **stored claims** for UI. Folium does **not** verify provider retention policy.

---

## AI tool use

Adapters implement chat/embeddings HTTP APIs. There is **no** tool-calling / agent loop in `folium.ai` (**Confirmed** absence of tools parameters). `supports_tools` exists on the provider model as capability metadata.

---

## Logging

Application logs persist in PostgreSQL with redaction helpers. Retention `APPLICATION_LOG_RETENTION_DAYS`. Admin CSV export.

---

## What `/health` does not prove

`GET /health` does not authenticate and does not check AI, worker liveness, or storage. Do not treat it as a security control.
