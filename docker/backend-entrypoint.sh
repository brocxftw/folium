#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
alembic upgrade head

if [[ "${1:-}" == "folium-worker" ]]; then
  exec folium-worker
fi

if [[ "${1:-}" == "folium-api" ]] || [[ $# -eq 0 ]]; then
  exec uvicorn folium.main:app --host 0.0.0.0 --port 8000
fi

exec "$@"
