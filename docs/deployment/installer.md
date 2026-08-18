# Interactive installer

Primary install path for operators. A [manual Compose install](install.md) remains supported.

## Quick start

Review the installer script, then run it. It is a single file (no tarball):

```bash
curl -fsSL -o install-folium.sh \
  https://github.com/brocxftw/folium/releases/latest/download/install-folium.sh
less install-folium.sh
bash install-folium.sh
```

Do not treat `| bash` as the only option. Pin a release by downloading that tag’s asset:

```bash
curl -fsSL -o install-folium.sh \
  https://github.com/brocxftw/folium/releases/download/v0.1.16/install-folium.sh
```

The script is a packed copy of `installer/install.sh` plus its libraries. It starts a **whiptail** TUI and then downloads that release’s `docker-compose.yml`.

From a git checkout (contributors; modular sources):

```bash
bash installer/install.sh
# rebuild the curl-able file:
bash installer/pack.sh /tmp/install-folium.sh
```

## What the installer does

1. Checks linux/amd64, Docker, disk, and memory. ARM is a hard failure.
2. Offers to install Docker Engine via `get.docker.com` only after confirmation.
3. Detects an existing install and offers **Update** (pull a pinned release image), Reconfigure, Repair, or Exit. It never silently rewrites `.env` secrets.
4. Chooses **pre-built GHCR images** (default) or **build from source** (clones the selected tag into `INSTALL_DIR/src`).
5. Pins a real `vX.Y.Z` release. It never stores `latest` as the installed version.
6. Writes `/opt/folium` by default (you may choose another directory; `/root` and `/tmp` are allowed at your own risk with a confirmation). Release `docker-compose.yml`, a small overlay (bind/port/`group_add` only), and `.env` (`chmod 600`). Backup files go to `$INSTALL_DIR/data/backups` (not the installer config snapshot folder).
7. Publishes **only the UI port** (default **9398**). The API host port (default **9099**) is unpublished unless you opt in. Nginx in `web` already proxies `/api`, `/health`, and `/mcp`.
8. Waits for `GET /health`, `/health/database`, `/health/storage`, and `/health/worker`. AI health is ignored.
9. Installs `/usr/local/bin/folium` (`status`, `start`, `stop`, `restart`, `logs`, `doctor`). `update` and `uninstall` are stubs in v1.

Secrets are generated with `openssl rand`. The bootstrap admin password is shown **once** on the success screen and is not written to the installer log. The welcome screen shows the exact log file path for that run (for example `/tmp/folium-install-20260817-123456.log`).

The TUI keeps a blue screen behind a **grey** dialog card. Cancel is labeled **Back**, and menus also include an explicit **Back** item where useful. Ctrl+C cancels immediately (restores the terminal; existing data is not deleted). Install progress (pull/build/start/health) is shown with a gauge; Compose output goes to the log file.

There is no timezone prompt. Folium timestamps are UTC.

## Layout

```text
/opt/folium/
  docker-compose.yml
  docker-compose.override.yml
  .env                    # mode 600
  install-state.json      # no secrets
  backups/                # installer config snapshots only — not Folium bundles
  data/backups/           # default host bind for /backups (.folium bundles)
  data/paddleocr/         # always local, even if documents are on NAS
  installer/              # packed `folium` CLI (or modular copy from a git install)
```

Paddle OCR cache is always under the install directory. Document/consume/export binds may be existing host paths, including NFS/CIFS mounts **already present**. The installer does not edit `/etc/fstab` and does not install NAS client packages.

`FRONTEND_ORIGIN` lists every browser URL you will use (comma-separated), for example `https://docs.example.com,http://192.168.1.10:9398`. If you use a reverse proxy on HTTPS but keep an HTTP LAN origin in the list, set `FOLIUM_SECURE_COOKIES=true` so session cookies use the `Secure` flag. The installer does not install Caddy or nginx on the host.

**MCP:** Streamable HTTP at `{origin}/mcp` through the UI port (recommended). Requires a Bearer API token from Settings → Profile. Optional: publish the API port and use `http://host:9099/mcp` directly.

Non-interactive installs under `/root` or `/tmp` require `FOLIUM_ACCEPT_RISKY_PATH=1`.

## Management CLI

```bash
folium status
folium start
folium stop
folium restart
folium logs
folium doctor
```

Override the install directory with `FOLIUM_INSTALL_DIR`. The CLI also reads `/etc/folium/install-dir`.

## Non-interactive (automation / smoke)

```bash
FOLIUM_UI=none FOLIUM_NONINTERACTIVE=1 \
  FOLIUM_VERSION=0.1.16 FOLIUM_VERSION_TAG=v0.1.16 \
  FOLIUM_INSTALL_DIR=/tmp/folium-installer-smoke \
  FOLIUM_BIND=127.0.0.1 FOLIUM_HTTP_PORT=18080 \
  FOLIUM_COMPOSE_PROJECT=folium-installer-smoke \
  FOLIUM_SKIP_CLI=1 \
  FOLIUM_RELEASE_COMPOSE_FILE=/path/to/docker-compose.yml \
  bash installer/install.sh --noninteractive
```

## Tests

```bash
bash installer/tests/run.sh
# optional live smoke (throwaway project, non-8080 port):
bash installer/tests/smoke.sh
```

CI runs ShellCheck and `installer/tests/run.sh`.

### Manual matrix (not fully automated)

| Case | Coverage |
|------|----------|
| Happy path, pre-built images, localhost:18080 | `smoke.sh` / operator TUI |
| Existing install: Update / Reconfigure / Repair / Exit | TUI on a host with `/opt/folium` |
| Source build (`git clone` + `compose.source.yaml`) | Manual |
| LAN bind `0.0.0.0` + detected IPv4 origin | Manual |
| Comma-separated `FRONTEND_ORIGIN` (proxy + LAN) | Manual |
| Install under `/root` or `/tmp` (risky path confirm) | Manual |
| Existing NFS/CIFS binds + extra GID | Manual (no fstab edits) |
| Occupied HTTP port | Installer asks for another port (does not exit) |
| Non-amd64 | Hard-fail in `system_check` (needs an ARM host) |
| Docker missing → get.docker.com | Manual / VM |
| Ctrl+C during TUI | Restores tty; does not delete data |

A development host that already runs Folium on 9398/9099 must use another Compose project name and HTTP port for installer smokes.

## Release assets

Each `v*` GitHub Release includes:

- `install-folium.sh` (standalone installer; the only file operators need to curl)
- `docker-compose.yml`
- `env.example` (canonical env template)
- `default.env.example` (compatibility alias; GitHub rejects a leading-dot `.env.example` asset name)
- `checksums.txt`
