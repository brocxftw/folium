#!/usr/bin/env bash
# Folium management CLI (installed as /usr/local/bin/folium).
# shellcheck disable=SC1091
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: folium <command>

  status     Compose service status
  start      docker compose up -d
  stop       docker compose stop
  restart    docker compose restart
  logs       docker compose logs (optional service names)
  doctor     System, storage, port, and health checks (does not print .env)
  update     Not in v1
  uninstall  Not in v1
  help       Show this help
EOF
}

discover_install_dir() {
  if [[ -n "${FOLIUM_INSTALL_DIR:-}" && -f "${FOLIUM_INSTALL_DIR}/install-state.json" ]]; then
    printf '%s' "${FOLIUM_INSTALL_DIR}"
    return 0
  fi
  if [[ -f /etc/folium/install-dir ]]; then
    local p
    p="$(tr -d '\n' </etc/folium/install-dir)"
    if [[ -d "${p}" ]]; then
      printf '%s' "${p}"
      return 0
    fi
  fi
  if [[ -f /opt/folium/install-state.json ]]; then
    printf '%s' "/opt/folium"
    return 0
  fi
  return 1
}

load_libs() {
  local root=""
  if [[ -f "${FOLIUM_INSTALL_DIR}/installer/lib/common.sh" ]]; then
    root="${FOLIUM_INSTALL_DIR}/installer"
  else
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  fi
  if [[ ! -f "${root}/lib/common.sh" ]]; then
    return 1
  fi
  # shellcheck source=lib/common.sh
  source "${root}/lib/common.sh"
  # shellcheck source=lib/logging.sh
  source "${root}/lib/logging.sh"
  FOLIUM_LOG_FILE="${FOLIUM_LOG_FILE:-/dev/null}"
  # shellcheck source=lib/docker.sh
  source "${root}/lib/docker.sh"
  # shellcheck source=lib/system.sh
  source "${root}/lib/system.sh"
  # shellcheck source=lib/storage.sh
  source "${root}/lib/storage.sh"
  # shellcheck source=lib/network.sh
  source "${root}/lib/network.sh"
  # shellcheck source=lib/state.sh
  source "${root}/lib/state.sh"
  # shellcheck source=lib/health.sh
  source "${root}/lib/health.sh"
}

cmd_not_v1() {
  echo "$1 is not available in installer v1." >&2
  exit 2
}

cmd_doctor() {
  echo "== Folium doctor =="
  echo "install_dir=${FOLIUM_INSTALL_DIR}"
  echo
  echo "-- system --"
  system_collect_report
  if ! is_amd64; then
    echo "ERROR: architecture is not amd64"
  fi
  if docker_info_ok; then
    echo "docker: ok"
    docker_compose_version || true
  else
    echo "ERROR: docker is not usable"
  fi
  echo
  echo "-- storage --"
  local path
  for path in \
    "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("storage",{}).get("documents",""))' "${FOLIUM_INSTALL_DIR}/install-state.json" 2>/dev/null || true)" \
    "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("storage",{}).get("consume",""))' "${FOLIUM_INSTALL_DIR}/install-state.json" 2>/dev/null || true)" \
    "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("storage",{}).get("export",""))' "${FOLIUM_INSTALL_DIR}/install-state.json" 2>/dev/null || true)" \
    "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("storage",{}).get("paddle_cache",""))' "${FOLIUM_INSTALL_DIR}/install-state.json" 2>/dev/null || true)"; do
    [[ -n "${path}" ]] || continue
    printf '%s  fstype=%s  uid=%s\n' "${path}" "$(storage_fstype "${path}" 2>/dev/null || echo missing)" "$(storage_uid_of "${path}" 2>/dev/null || echo missing)"
  done
  echo
  echo "-- port --"
  local port
  port="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("network",{}).get("port",8080))' "${FOLIUM_INSTALL_DIR}/install-state.json")"
  FOLIUM_HTTP_PORT="${port}"
  if network_port_in_use "${port}"; then
    echo "port ${port} is listening (expected if Folium is up)"
    network_port_users "${port}" || true
  else
    echo "port ${port} is not listening"
  fi
  echo
  echo "-- services --"
  folium_compose ps || true
  echo
  echo "-- health --"
  health_snapshot
}

main() {
  local cmd="${1:-status}"
  shift || true
  case "${cmd}" in
    -h|--help|help) usage; exit 0 ;;
    update) cmd_not_v1 update ;;
    uninstall) cmd_not_v1 uninstall ;;
  esac
  FOLIUM_INSTALL_DIR="$(discover_install_dir)" || {
    echo "Could not find a Folium install. Set FOLIUM_INSTALL_DIR." >&2
    exit 1
  }
  export FOLIUM_INSTALL_DIR
  if [[ -f "${FOLIUM_INSTALL_DIR}/install-state.json" ]]; then
    FOLIUM_COMPOSE_PROJECT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("compose_project","folium"))' "${FOLIUM_INSTALL_DIR}/install-state.json")"
    FOLIUM_HTTP_PORT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("network",{}).get("port",8080))' "${FOLIUM_INSTALL_DIR}/install-state.json")"
    export FOLIUM_COMPOSE_PROJECT FOLIUM_HTTP_PORT
  fi
  load_libs || {
    echo "Installer libraries were not found under ${FOLIUM_INSTALL_DIR}/installer." >&2
    exit 1
  }
  case "${cmd}" in
    status) folium_compose ps ;;
    start) folium_compose up -d ;;
    stop) folium_compose stop ;;
    restart) folium_compose restart ;;
    logs) folium_compose logs "$@" ;;
    doctor) cmd_doctor ;;
    *) usage; exit 2 ;;
  esac
}

main "$@"
