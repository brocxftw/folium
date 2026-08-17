#!/usr/bin/env bash
# Throwaway Compose smoke: non-8080 port, dedicated project name.
# Does not touch the live Folium stack. Does not install /usr/local/bin/folium.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT}/.." && pwd)"
SMOKE_DIR="${FOLIUM_SMOKE_DIR:-/tmp/folium-installer-smoke}"
PORT="${FOLIUM_HTTP_PORT:-18080}"
PROJECT="${FOLIUM_COMPOSE_PROJECT:-folium-installer-smoke}"

if ss -ltnH "sport = :${PORT}" 2>/dev/null | grep -q .; then
  echo "Port ${PORT} is in use; set FOLIUM_HTTP_PORT to a free port." >&2
  exit 1
fi

rm -rf "${SMOKE_DIR}"
mkdir -p "${SMOKE_DIR}"

cleanup() {
  if [[ "${FOLIUM_SMOKE_KEEP:-0}" != "1" ]]; then
    (
      cd "${SMOKE_DIR}"
      docker compose -p "${PROJECT}" -f docker-compose.yml -f docker-compose.override.yml down -v >/dev/null 2>&1 || true
    )
    rm -rf "${SMOKE_DIR}"
  fi
}
trap cleanup EXIT

export FOLIUM_UI=none
export FOLIUM_NONINTERACTIVE=1
export FOLIUM_SKIP_CLI=1
export FOLIUM_INSTALL_DIR="${SMOKE_DIR}"
export FOLIUM_METHOD=image
export FOLIUM_VERSION=0.1.16
export FOLIUM_VERSION_TAG=v0.1.16
export FOLIUM_BIND=127.0.0.1
export FOLIUM_HTTP_PORT="${PORT}"
export FOLIUM_EXPOSE_API=0
export FOLIUM_COMPOSE_PROJECT="${PROJECT}"
export FOLIUM_RELEASE_COMPOSE_FILE="${REPO_ROOT}/docker-compose.yml"
export FOLIUM_HEALTH_RETRIES="${FOLIUM_HEALTH_RETRIES:-36}"
export FOLIUM_DOCS_PATH="${SMOKE_DIR}/data/documents"
export FOLIUM_CONSUME_PATH="${SMOKE_DIR}/data/consume"
export FOLIUM_EXPORT_PATH="${SMOKE_DIR}/data/export"
export FOLIUM_PADDLE_PATH="${SMOKE_DIR}/data/paddleocr"
export FOLIUM_FRONTEND_ORIGIN="http://127.0.0.1:${PORT}"

bash "${ROOT}/install.sh" --noninteractive

curl -sf "http://127.0.0.1:${PORT}/health"
echo
curl -sf "http://127.0.0.1:${PORT}/health/database"
echo
echo "Smoke install succeeded on ${PROJECT} port ${PORT}."
