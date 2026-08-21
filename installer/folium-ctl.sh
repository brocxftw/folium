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
  update     Upgrade install (default: newest beta; or latest / vX.Y.Z[-beta.N])
  uninstall  Not in v1
  help       Show this help

Update examples:
  folium update                 # newest beta prerelease
  folium update beta            # same
  folium update latest          # newest stable
  folium update v0.1.24-beta.5  # exact pin

Hosts still on an older CLI stub need one installer re-run before update exists.
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
  if [[ "${FOLIUM_PACKED:-0}" == "1" ]]; then
    FOLIUM_LOG_FILE="${FOLIUM_LOG_FILE:-/dev/null}"
    return 0
  fi
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
  # shellcheck source=lib/ctl_update.sh
  source "${root}/lib/ctl_update.sh"
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
  port="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("network",{}).get("port",9398))' "${FOLIUM_INSTALL_DIR}/install-state.json")"
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

# Download a fresh release installer and run noninteractive --update.
cmd_update() {
  local target
  if ! target="$(ctl_update_normalize_target "${1:-}")"; then
    echo "Invalid version '${1:-}'. Use beta, latest, or a pin like v0.1.24-beta.5." >&2
    exit 2
  fi
  if [[ -n "${2:-}" ]]; then
    echo "Unexpected argument: $2" >&2
    usage
    exit 2
  fi
  if [[ ! -f "${FOLIUM_INSTALL_DIR}/.env" ]]; then
    echo "No .env in ${FOLIUM_INSTALL_DIR}." >&2
    exit 1
  fi
  if [[ ! -f "${FOLIUM_INSTALL_DIR}/docker-compose.yml" ]]; then
    echo "No docker-compose.yml in ${FOLIUM_INSTALL_DIR}." >&2
    exit 1
  fi

  local url tmp rc=0
  if ! url="$(ctl_update_installer_url "${target}")"; then
    echo "Could not resolve installer download URL for '${target}'." >&2
    exit 1
  fi
  tmp="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${tmp}'" EXIT
  echo "Downloading installer: ${url}" >&2
  if ! curl -fsSL --max-time 60 -o "${tmp}" "${url}"; then
    echo "Failed to download installer from ${url}" >&2
    exit 1
  fi
  chmod 700 "${tmp}"
  echo "Updating ${FOLIUM_INSTALL_DIR} to ${target}..." >&2
  FOLIUM_INSTALL_DIR="${FOLIUM_INSTALL_DIR}" bash "${tmp}" \
    --noninteractive --update --version "${target}" --json || rc=$?
  trap - EXIT
  rm -f "${tmp}"
  return "${rc}"
}

main() {
  local cmd="${1:-status}"
  shift || true
  case "${cmd}" in
    -h|--help|help) usage; exit 0 ;;
    uninstall) cmd_not_v1 uninstall ;;
  esac
  FOLIUM_INSTALL_DIR="$(discover_install_dir)" || {
    echo "Could not find a Folium install. Set FOLIUM_INSTALL_DIR." >&2
    exit 1
  }
  export FOLIUM_INSTALL_DIR
  if [[ -f "${FOLIUM_INSTALL_DIR}/install-state.json" ]]; then
    FOLIUM_COMPOSE_PROJECT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("compose_project","folium"))' "${FOLIUM_INSTALL_DIR}/install-state.json")"
    FOLIUM_HTTP_PORT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("network",{}).get("port",9398))' "${FOLIUM_INSTALL_DIR}/install-state.json")"
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
    update) cmd_update "$@" ;;
    *) usage; exit 2 ;;
  esac
}

main "$@"
