#!/usr/bin/env bash
# Folium interactive installer (whiptail TUI).
# shellcheck disable=SC1091
set -euo pipefail

INSTALLER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export INSTALLER_ROOT
FOLIUM_DEFAULT_INSTALL_DIR="${FOLIUM_DEFAULT_INSTALL_DIR:-${INSTALLER_ROOT}}"

if [[ "${FOLIUM_PACKED:-0}" != "1" ]]; then
  # shellcheck source=lib/common.sh
  source "${INSTALLER_ROOT}/lib/common.sh"
  # shellcheck source=lib/logging.sh
  source "${INSTALLER_ROOT}/lib/logging.sh"
  # shellcheck source=lib/ui.sh
  source "${INSTALLER_ROOT}/lib/ui.sh"
  # shellcheck source=lib/state.sh
  source "${INSTALLER_ROOT}/lib/state.sh"
  # shellcheck source=lib/system.sh
  source "${INSTALLER_ROOT}/lib/system.sh"
  # shellcheck source=lib/docker.sh
  source "${INSTALLER_ROOT}/lib/docker.sh"
  # shellcheck source=lib/dependencies.sh
  source "${INSTALLER_ROOT}/lib/dependencies.sh"
  # shellcheck source=lib/storage.sh
  source "${INSTALLER_ROOT}/lib/storage.sh"
  # shellcheck source=lib/network.sh
  source "${INSTALLER_ROOT}/lib/network.sh"
  # shellcheck source=lib/config.sh
  source "${INSTALLER_ROOT}/lib/config.sh"
  # shellcheck source=lib/health.sh
  source "${INSTALLER_ROOT}/lib/health.sh"
fi

FOLIUM_NONINTERACTIVE="${FOLIUM_NONINTERACTIVE:-0}"
FOLIUM_KEEP_SECRETS="${FOLIUM_KEEP_SECRETS:-0}"
FOLIUM_JSON="${FOLIUM_JSON:-0}"
FOLIUM_MODE="${FOLIUM_MODE:-install}"
SHOW_ADMIN_PASSWORD=0
FOLIUM_HEALTHY="${FOLIUM_HEALTHY:-1}"

on_interrupt() {
  # Set the flag first so any UI retry loop stops immediately.
  FOLIUM_INTERRUPTED=1
  export FOLIUM_INTERRUPTED
  # Avoid re-entering cleanup if a nested signal arrives.
  trap '' INT TERM
  ui_kill_whiptail_children 2>/dev/null || true
  ui_session_end 2>/dev/null || true
  stty sane </dev/tty 2>/dev/null || stty sane 2>/dev/null || true
  printf '\nInstall cancelled. Existing data was not deleted.\n' >/dev/tty 2>/dev/null \
    || printf '\nInstall cancelled. Existing data was not deleted.\n' >&2
  log_info "interrupted by signal"
  exit 130
}

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Interactive (default): whiptail TUI that writes an install directory,
Compose overlay, and .env, then pulls or builds images and waits for health.

Options:
  --noninteractive       Run without TUI (automation / CI / agents)
  --update               Update an existing install (implies --noninteractive)
  --version <tag>        Pin or alias: vX.Y.Z, X.Y.Z-beta.N, latest, beta
  --preserve-secrets     Keep existing .env secrets (default on update)
  --json                 Print one JSON summary line on completion
  -h, --help             Show this help

Non-interactive environment variables (also see docs/deployment/installer.md):
  FOLIUM_VERSION / FOLIUM_VERSION_TAG   pinned release, or latest / beta
  FOLIUM_INSTALL_DIR                    install root (default /opt/folium)
  FOLIUM_KEEP_SECRETS=1                 preserve secrets when .env exists
  FOLIUM_MODE=update|install            force update vs fresh install
  FOLIUM_BIND, FOLIUM_HTTP_PORT, FOLIUM_API_PORT, FOLIUM_EXPOSE_API
  FRONTEND_ORIGIN / FOLIUM_FRONTEND_ORIGIN
  FOLIUM_DOCUMENTS_HOST, FOLIUM_CONSUME_HOST, FOLIUM_EXPORT_HOST, FOLIUM_PADDLE_CACHE_HOST
  FOLIUM_SECRET_KEY, FOLIUM_ENCRYPTION_KEY, POSTGRES_PASSWORD, FOLIUM_ADMIN_*
  COMPOSE_PROJECT_NAME, FOLIUM_ACCEPT_RISKY_PATH=1, FOLIUM_SKIP_CLI=1

Examples:
  # Fresh install of latest stable
  bash install-folium.sh --noninteractive --version latest

  # Update existing install to newest beta (secrets/bind preserved)
  bash install-folium.sh --noninteractive --update --version beta --json

Exit codes:
  0  success and healthy
  1  install/update failed
  2  bad arguments / config
  3  completed but health checks failed
  130 interrupted
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --noninteractive)
        FOLIUM_NONINTERACTIVE=1
        FOLIUM_UI=none
        export FOLIUM_UI
        shift
        ;;
      --update)
        FOLIUM_NONINTERACTIVE=1
        FOLIUM_UI=none
        export FOLIUM_UI
        FOLIUM_MODE=update
        shift
        ;;
      --version)
        if [[ $# -lt 2 || -z "${2:-}" ]]; then
          echo "Missing value for --version" >&2
          usage
          exit 2
        fi
        FOLIUM_VERSION="$2"
        FOLIUM_VERSION_TAG="v$(config_strip_v_prefix "$2")"
        # Allow aliases to pass through resolve later (vlatest / vbeta are wrong).
        case "$(config_strip_v_prefix "$2")" in
          latest|beta)
            FOLIUM_VERSION="$(config_strip_v_prefix "$2")"
            FOLIUM_VERSION_TAG="${FOLIUM_VERSION}"
            ;;
        esac
        shift 2
        ;;
      --preserve-secrets)
        FOLIUM_KEEP_SECRETS=1
        shift
        ;;
      --json)
        FOLIUM_JSON=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 2
        ;;
    esac
  done
}

emit_json_summary() {
  [[ "${FOLIUM_JSON}" == "1" ]] || return 0
  local healthy_json="false"
  [[ "${FOLIUM_HEALTHY:-0}" == "1" ]] && healthy_json="true"
  FOLIUM_SUMMARY_HEALTHY="${healthy_json}" \
  FOLIUM_VERSION="${FOLIUM_VERSION:-}" \
  FOLIUM_VERSION_TAG="${FOLIUM_VERSION_TAG:-}" \
  FOLIUM_INSTALL_DIR="${FOLIUM_INSTALL_DIR:-}" \
  FOLIUM_FRONTEND_ORIGIN="${FOLIUM_FRONTEND_ORIGIN:-}" \
  FOLIUM_MODE="${FOLIUM_MODE:-install}" \
  python3 -c 'import json,os
print(json.dumps({
  "version": os.environ.get("FOLIUM_VERSION",""),
  "version_tag": os.environ.get("FOLIUM_VERSION_TAG",""),
  "healthy": os.environ.get("FOLIUM_SUMMARY_HEALTHY","false") == "true",
  "install_dir": os.environ.get("FOLIUM_INSTALL_DIR",""),
  "frontend_origin": os.environ.get("FOLIUM_FRONTEND_ORIGIN",""),
  "mode": os.environ.get("FOLIUM_MODE","install"),
}, separators=(",", ":")))'
}

# Print summary (and optional JSON), then exit with the health-aware status code.
finish_noninteractive() {
  success_screen
  emit_json_summary
  if [[ "${FOLIUM_HEALTHY:-0}" == "1" ]]; then
    exit 0
  fi
  exit 3
}

ensure_whiptail() {
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    return 0
  fi
  if ui_available; then
    return 0
  fi
  printf 'whiptail is not installed. Install it now? [Y/n] '
  local ans=""
  read -r ans || true
  case "${ans}" in
    n|N|no|NO) echo "whiptail is required."; exit 1 ;;
  esac
  dep_install_whiptail
}

abort() {
  local msg="$1"
  log_error "${msg}"
  ui_gauge_stop 2>/dev/null || true
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s\n' "${msg}" >&2
  else
    ui_msgbox "${msg}"
  fi
  ui_session_end 2>/dev/null || true
  exit 1
}

ensure_docker_ready() {
  if docker_info_ok && docker_compose_ok; then
    log_info "docker ok: $(docker_compose_version)"
    return 0
  fi
  if [[ "${FOLIUM_NONINTERACTIVE}" == "1" ]]; then
    abort "Docker Engine and the Compose plugin are required."
  fi
  local choice=""
  FOLIUM_UI_NOCANCEL=1
  choice="$(ui_menu "Docker Engine is not running (or Compose is missing).

Folium can run Docker's official install script (get.docker.com). This requires root, adds Docker's apt/yum repository, and starts the docker service.

Ctrl+C cancels the installer." \
    install "Install Docker Engine now" \
    exit "Exit installer")" || abort "Docker is required."
  FOLIUM_UI_NOCANCEL=0
  if [[ "${choice}" != "install" ]]; then
    abort "Docker is required. Install Docker, then re-run this installer."
  fi
  ui_gauge_start "Installing Docker Engine..."
  ui_gauge_update 20 "Running get.docker.com (output in log)"
  local rc=0
  dep_install_docker_engine >>"${FOLIUM_LOG_FILE}" 2>&1 || rc=$?
  ui_gauge_stop
  if [[ "${rc}" -ne 0 ]]; then
    abort "Docker installation failed. See ${FOLIUM_LOG_FILE}."
  fi
  if ! docker_info_ok || ! docker_compose_ok; then
    abort "Docker is installed but not usable yet. You may need to log out and back in, then re-run the installer."
  fi
}

prompt_existing() {
  local dir="$1"
  local current_ver=""
  local choice=""
  current_ver="$(config_env_get FOLIUM_VERSION "${dir}/.env" 2>/dev/null || true)"
  if [[ -z "${current_ver}" ]]; then
    current_ver="$(FOLIUM_INSTALL_DIR="${dir}" state_read_field version 2>/dev/null || true)"
  fi
  FOLIUM_UI_NOCANCEL=1
  choice="$(ui_menu "Folium is already installed in:
${dir}
${current_ver:+Current version: ${current_ver}}

Update pulls the selected release images and restarts the stack (keeps data and .env secrets).
Reconfigure walks through settings again.
Repair restarts the stack and waits for health without rewriting .env.

Ctrl+C cancels." \
    update "Update (pull release images)" \
    reconfigure "Reconfigure" \
    repair "Repair (re-up + health)" \
    exit "Exit")"
  FOLIUM_UI_NOCANCEL=0
  case "${choice}" in
    update) FOLIUM_MODE=update ;;
    reconfigure) FOLIUM_MODE=reconfigure ;;
    repair) FOLIUM_MODE=repair ;;
    *) ui_session_end; exit 0 ;;
  esac
}

discover_existing_install() {
  local dir=""
  dir="$(state_discover_dir || true)"
  if [[ -z "${dir}" && -f "${FOLIUM_DEFAULT_INSTALL_DIR}/docker-compose.yml" ]]; then
    dir="${FOLIUM_DEFAULT_INSTALL_DIR}"
  fi
  if [[ -z "${dir}" && -f "${FOLIUM_DEFAULT_INSTALL_DIR}/.env" ]]; then
    dir="${FOLIUM_DEFAULT_INSTALL_DIR}"
  fi
  [[ -n "${dir}" ]] || return 1
  printf '%s' "${dir}"
}

load_existing_defaults() {
  # CLI --version / process env must win over install-state and .env (issue #65).
  local prior_version="${FOLIUM_VERSION:-}"
  local prior_version_tag="${FOLIUM_VERSION_TAG:-}"

  FOLIUM_INSTALL_DIR="${FOLIUM_INSTALL_DIR:-$(state_discover_dir || true)}"
  FOLIUM_INSTALL_DIR="${FOLIUM_INSTALL_DIR:-${FOLIUM_DEFAULT_INSTALL_DIR}}"
  if [[ -f "${FOLIUM_INSTALL_DIR}/install-state.json" ]]; then
    FOLIUM_METHOD="$(state_read_field install_method || true)"
    FOLIUM_VERSION="$(state_read_field version || true)"
    FOLIUM_VERSION_TAG="$(state_read_field version_tag || true)"
    FOLIUM_BIND="$(state_read_field network.bind || true)"
    FOLIUM_HTTP_PORT="$(state_read_field network.port || true)"
    FOLIUM_FRONTEND_ORIGIN="$(state_read_field network.frontend_origin || true)"
    FOLIUM_DOCS_PATH="$(state_read_field storage.documents || true)"
    FOLIUM_CONSUME_PATH="$(state_read_field storage.consume || true)"
    FOLIUM_EXPORT_PATH="$(state_read_field storage.export || true)"
    FOLIUM_PADDLE_PATH="$(state_read_field storage.paddle_cache || true)"
    FOLIUM_EXTRA_GID="$(state_read_field extra_gid || true)"
    FOLIUM_COMPOSE_PROJECT="$(state_read_field compose_project || true)"
    if [[ "$(state_read_field network.expose_api || true)" == "true" ]]; then
      FOLIUM_EXPOSE_API=1
    fi
    FOLIUM_API_PORT="$(state_read_field network.api_port || true)"
  fi
  if [[ -f "${FOLIUM_INSTALL_DIR}/.env" ]]; then
    FOLIUM_KEEP_SECRETS=1
    FOLIUM_SECRET_KEY="$(config_env_get FOLIUM_SECRET_KEY || true)"
    FOLIUM_ENCRYPTION_KEY="$(config_env_get FOLIUM_ENCRYPTION_KEY || true)"
    POSTGRES_PASSWORD="$(config_env_get POSTGRES_PASSWORD || true)"
    FOLIUM_ADMIN_PASSWORD="$(config_env_get FOLIUM_ADMIN_PASSWORD || true)"
    FOLIUM_ADMIN_USERNAME="$(config_env_get FOLIUM_ADMIN_USERNAME || true)"
    FOLIUM_VERSION="$(config_env_get FOLIUM_VERSION || printf '%s' "${FOLIUM_VERSION:-}")"
    FOLIUM_FRONTEND_ORIGIN="$(config_env_get FRONTEND_ORIGIN || printf '%s' "${FOLIUM_FRONTEND_ORIGIN:-}")"
    FOLIUM_BIND="$(config_env_get FOLIUM_BIND || printf '%s' "${FOLIUM_BIND:-}")"
    FOLIUM_HTTP_PORT="$(config_env_get FOLIUM_HTTP_PORT || printf '%s' "${FOLIUM_HTTP_PORT:-}")"
    FOLIUM_API_PORT="$(config_env_get FOLIUM_API_PORT || printf '%s' "${FOLIUM_API_PORT:-}")"
    FOLIUM_COMPOSE_PROJECT="$(config_env_get COMPOSE_PROJECT_NAME || printf '%s' "${FOLIUM_COMPOSE_PROJECT:-}")"
    FOLIUM_DOCS_PATH="$(config_env_get FOLIUM_DOCUMENTS_HOST || printf '%s' "${FOLIUM_DOCS_PATH:-}")"
    FOLIUM_CONSUME_PATH="$(config_env_get FOLIUM_CONSUME_HOST || printf '%s' "${FOLIUM_CONSUME_PATH:-}")"
    FOLIUM_EXPORT_PATH="$(config_env_get FOLIUM_EXPORT_HOST || printf '%s' "${FOLIUM_EXPORT_PATH:-}")"
    FOLIUM_PADDLE_PATH="$(config_env_get FOLIUM_PADDLE_CACHE_HOST || printf '%s' "${FOLIUM_PADDLE_PATH:-}")"
  fi

  if [[ -n "${prior_version}" || -n "${prior_version_tag}" ]]; then
    config_prefer_requested_version "${prior_version}" "${prior_version_tag}"
  else
    # .env may pin FOLIUM_VERSION while install-state still has an older version_tag;
    # resolve prefers TAG, so keep the pair consistent when using persisted defaults.
    config_sync_version_tag
  fi
}

wizard_method() {
  local choice=""
  choice="$(ui_menu "How should Folium be installed?

Pre-built images pull ghcr.io/brocxftw/folium-* for the selected release (recommended).
Build from source clones that release tag and builds images locally. Git is required.

Use Back to return to the previous screen. Ctrl+C exits." \
    image "Pre-built image (recommended)" \
    source "Build from source" \
    back "Back")" || return "${UI_BACK}"
  if [[ "${choice}" == "back" ]]; then
    return "${UI_BACK}"
  fi
  FOLIUM_METHOD="${choice}"
  return "${UI_OK}"
}

wizard_version() {
  local latest tags choice=""
  latest="$(github_latest_tag || true)"
  if [[ -z "${latest}" ]]; then
    FOLIUM_VERSION_TAG="$(ui_input "Could not list GitHub Releases. Enter a version tag (for example v0.1.23 or v0.1.24-beta.1):" "${FOLIUM_VERSION_TAG:-v0.1.23}")" || return "${UI_BACK}"
  else
    tags="$(github_release_tags || printf '%s\n' "${latest}")"
    local -a ordered=()
    local -a menu_items=()
    local tag
    if [[ -n "${latest}" ]] && grep -qxF "${latest}" <<<"${tags}"; then
      ordered+=("${latest}")
    fi
    while IFS= read -r tag; do
      [[ -n "${tag}" && "${tag}" != "${latest}" ]] || continue
      ordered+=("${tag}")
    done <<<"${tags}"
    for tag in "${ordered[@]}"; do
      menu_items+=("${tag}" "$(github_release_menu_label "${tag}" "${latest}")")
    done
    choice="$(ui_menu "Select a Folium release. The installer pins this version (never stores 'latest'). Beta tags are prereleases." "${menu_items[@]}")" || return "${UI_BACK}"
    FOLIUM_VERSION_TAG="${choice}"
  fi
  FOLIUM_VERSION="$(config_strip_v_prefix "${FOLIUM_VERSION_TAG}")"
  if [[ "${FOLIUM_VERSION}" == "latest" || "${FOLIUM_VERSION}" == "beta" ]] || ! config_is_pinned_version "${FOLIUM_VERSION}"; then
    ui_msgbox "Refusing to install an unpinned version (${FOLIUM_VERSION_TAG}). Choose a vX.Y.Z or vX.Y.Z-beta.N release."
    return 1
  fi
  return "${UI_OK}"
}

wizard_directory() {
  local dir=""
  dir="$(ui_input "Install directory:" "${FOLIUM_INSTALL_DIR:-${FOLIUM_DEFAULT_INSTALL_DIR}}")" || return "${UI_BACK}"
  dir="$(storage_normalize_path "${dir}")"
  if storage_is_critical_forbidden_path "${dir}"; then
    ui_msgbox "Refusing to install into ${dir}. Choose another directory."
    return 1
  fi
  if ! storage_validate_install_path "${dir}"; then
    if storage_is_risky_install_path "${dir}"; then
      ui_msgbox "Refusing to install into ${dir} without accepting the risk.

Set FOLIUM_ACCEPT_RISKY_PATH=1 for non-interactive installs under /root or /tmp."
    else
      ui_msgbox "Refusing to install into ${dir}. Choose another directory."
    fi
    return 1
  fi
  FOLIUM_INSTALL_DIR="${dir}"
  FOLIUM_COMPOSE_PROJECT="${FOLIUM_COMPOSE_PROJECT:-${FOLIUM_DEFAULT_PROJECT}}"
  return "${UI_OK}"
}

wizard_storage_kind() {
  local choice=""
  choice="$(ui_menu "Where should document files live?

Managed directories are created under the install directory.
Existing host paths are used as-is (including NFS/CIFS mounts already on this host). The installer will not edit /etc/fstab." \
    managed "Managed paths under the install directory" \
    existing "Use existing host paths" \
    back "Back")" || return "${UI_BACK}"
  if [[ "${choice}" == "back" ]]; then
    return "${UI_BACK}"
  fi
  FOLIUM_STORAGE_KIND="${choice}"
  if [[ "${choice}" == "managed" ]]; then
    FOLIUM_DOCS_PATH="$(storage_normalize_path "${FOLIUM_INSTALL_DIR}/data/documents")"
    FOLIUM_CONSUME_PATH="$(storage_normalize_path "${FOLIUM_INSTALL_DIR}/data/consume")"
    FOLIUM_EXPORT_PATH="$(storage_normalize_path "${FOLIUM_INSTALL_DIR}/data/export")"
  fi
  FOLIUM_PADDLE_PATH="${FOLIUM_INSTALL_DIR}/data/paddleocr"
  return "${UI_OK}"
}

wizard_storage_paths() {
  local docs consume export_path
  docs="$(ui_input "Documents host path:" "${FOLIUM_DOCS_PATH:-${FOLIUM_INSTALL_DIR}/data/documents}")" || return "${UI_BACK}"
  consume="$(ui_input "Consume (drop folder) host path:" "${FOLIUM_CONSUME_PATH:-${FOLIUM_INSTALL_DIR}/data/consume}")" || return "${UI_BACK}"
  export_path="$(ui_input "Export host path:" "${FOLIUM_EXPORT_PATH:-${FOLIUM_INSTALL_DIR}/data/export}")" || return "${UI_BACK}"
  FOLIUM_DOCS_PATH="$(storage_normalize_path "${docs}")"
  FOLIUM_CONSUME_PATH="$(storage_normalize_path "${consume}")"
  FOLIUM_EXPORT_PATH="$(storage_normalize_path "${export_path}")"
  FOLIUM_PADDLE_PATH="${FOLIUM_INSTALL_DIR}/data/paddleocr"
  local p
  for p in "${FOLIUM_DOCS_PATH}" "${FOLIUM_CONSUME_PATH}" "${FOLIUM_EXPORT_PATH}" "${FOLIUM_PADDLE_PATH}"; do
    if ! storage_validate_bind_path "${p}"; then
      ui_msgbox "Refusing storage path ${p}. Choose another path."
      return 1
    fi
  done
  return "${UI_OK}"
}

wizard_extra_gid() {
  local gid_raw=""
  gid_raw="$(ui_input "Optional extra host GID for 0770 CIFS binds (leave empty for none):" "${FOLIUM_EXTRA_GID:-}")" || return "${UI_BACK}"
  if [[ -n "${gid_raw}" && ! "${gid_raw}" =~ ^[0-9]+$ ]]; then
    ui_msgbox "Extra GID must be numeric (or empty)."
    return 1
  fi
  FOLIUM_EXTRA_GID="${gid_raw}"
  return "${UI_OK}"
}

wizard_bind() {
  local bind_choice=""
  bind_choice="$(ui_menu "Who should be able to open the UI?

LAN bind (0.0.0.0) listens on all interfaces.
Localhost (127.0.0.1) is for this host or a reverse proxy on the same machine." \
    lan "LAN — bind 0.0.0.0" \
    local "Localhost — bind 127.0.0.1" \
    back "Back")" || return "${UI_BACK}"
  if [[ "${bind_choice}" == "back" ]]; then
    return "${UI_BACK}"
  fi
  if [[ "${bind_choice}" == "local" ]]; then
    FOLIUM_BIND="127.0.0.1"
  else
    FOLIUM_BIND="0.0.0.0"
  fi
  return "${UI_OK}"
}

wizard_http_port() {
  local port="${FOLIUM_HTTP_PORT:-${FOLIUM_DEFAULT_HTTP_PORT}}"
  local users=""
  while true; do
    port="$(ui_input "HTTP port for the UI:" "${port}")" || return "${UI_BACK}"
    if ! network_port_valid "${port}"; then
      ui_msgbox "Invalid port: ${port}

Enter a number from 1 to 65535."
      continue
    fi
    if network_port_blocked "${port}"; then
      users="$(network_port_users "${port}" || true)"
      ui_msgbox "Port ${port} is already in use.

${users}

Enter a different HTTP port."
      continue
    fi
    FOLIUM_HTTP_PORT="${port}"
    return "${UI_OK}"
  done
}

wizard_expose_api() {
  local choice=""
  FOLIUM_API_PORT="${FOLIUM_API_PORT:-${FOLIUM_DEFAULT_API_PORT}}"
  choice="$(ui_menu "Publish the API/OpenAPI port on ${FOLIUM_BIND} as well?

The UI already proxies /api and /health. Leave this off unless you need OpenAPI from other hosts." \
    no "No (recommended)" \
    yes "Yes, publish OpenAPI" \
    back "Back")" || return "${UI_BACK}"
  if [[ "${choice}" == "back" ]]; then
    return "${UI_BACK}"
  fi
  if [[ "${choice}" != "yes" ]]; then
    FOLIUM_EXPOSE_API=0
    return "${UI_OK}"
  fi
  FOLIUM_EXPOSE_API=1
  local port="${FOLIUM_API_PORT:-${FOLIUM_DEFAULT_API_PORT}}"
  local users=""
  while true; do
    port="$(ui_input "Host port to publish for OpenAPI (container stays 8000):" "${port}")" || return "${UI_BACK}"
    if ! network_port_valid "${port}"; then
      ui_msgbox "Invalid port: ${port}

Enter a number from 1 to 65535."
      continue
    fi
    if [[ "${port}" == "${FOLIUM_HTTP_PORT}" ]]; then
      ui_msgbox "Port ${port} is already chosen for the UI. Pick another port."
      continue
    fi
    if network_port_blocked "${port}"; then
      users="$(network_port_users "${port}" || true)"
      ui_msgbox "Port ${port} is already in use.

${users}

Enter a different host port."
      continue
    fi
    FOLIUM_API_PORT="${port}"
    return "${UI_OK}"
  done
}

wizard_origin() {
  local choice="" origin=""
  choice="$(ui_menu "Browser origin (FRONTEND_ORIGIN)

List every URL you will open in a browser (comma-separated). Include reverse-proxy URLs and direct LAN URLs if you use both.

The installer does not install Caddy or nginx on the host." \
    default "Default from bind address and port" \
    custom "Enter custom origin(s)" \
    back "Back")" || return "${UI_BACK}"
  if [[ "${choice}" == "back" ]]; then
    return "${UI_BACK}"
  fi
  if [[ "${choice}" == "default" ]]; then
    FOLIUM_FRONTEND_ORIGIN="$(network_origin_for "${FOLIUM_BIND}" "${FOLIUM_HTTP_PORT}" "")"
    return "${UI_OK}"
  fi
  origin="$(ui_input "Origins (comma-separated, no spaces after commas):" "${FOLIUM_FRONTEND_ORIGIN:-https://docs.example.com,http://192.168.1.1:${FOLIUM_HTTP_PORT}}")" || return "${UI_BACK}"
  origin="$(printf '%s' "${origin}" | tr -d ' ')"
  if [[ -z "${origin}" ]]; then
    ui_msgbox "At least one origin is required."
    return 1
  fi
  FOLIUM_FRONTEND_ORIGIN="${origin}"
  return "${UI_OK}"
}

wizard_secrets() {
  FOLIUM_ADMIN_USERNAME="${FOLIUM_ADMIN_USERNAME:-admin}"
  if [[ "${FOLIUM_KEEP_SECRETS}" == "1" && -n "${FOLIUM_SECRET_KEY:-}" ]]; then
    local choice=""
    choice="$(ui_menu "Keep existing secrets and admin password in .env?

Choosing No generates new keys. That does not rotate an already-bootstrapped admin account." \
      keep "Keep existing secrets" \
      rotate "Generate new secrets" \
      back "Back")" || return "${UI_BACK}"
    if [[ "${choice}" == "back" ]]; then
      return "${UI_BACK}"
    fi
    if [[ "${choice}" == "keep" ]]; then
      SHOW_ADMIN_PASSWORD=0
      return "${UI_OK}"
    fi
  fi
  FOLIUM_SECRET_KEY="$(config_generate_secret 32)"
  FOLIUM_ENCRYPTION_KEY="$(config_generate_secret 32)"
  POSTGRES_PASSWORD="$(config_generate_secret 24)"
  FOLIUM_ADMIN_PASSWORD="$(config_generate_secret 12)"
  if ! config_postgres_password_ok "${POSTGRES_PASSWORD}"; then
    abort "Generated database password contained a reserved character. Re-run the installer."
  fi
  SHOW_ADMIN_PASSWORD=1
  return "${UI_OK}"
}

wizard_summary() {
  local summary_file rc=0
  summary_file="$(mktemp)"
  config_render_summary >"${summary_file}"
  ui_confirm_summary_file "${summary_file}" || rc=$?
  rm -f "${summary_file}"
  case "${rc}" in
    0) return "${UI_OK}" ;;
    "${UI_CANCEL}")
      ui_session_end
      exit 0
      ;;
    *) return "${UI_BACK}" ;;
  esac
}

# Return 1 from a step to stay on that screen (validation failed).
wizard_dispatch() {
  local step="$1"
  local rc=0
  set +e
  case "${step}" in
    0) wizard_method ;;
    1) wizard_version ;;
    2) wizard_directory ;;
    3) wizard_storage_kind ;;
    4) wizard_storage_paths ;;
    5) wizard_extra_gid ;;
    6) wizard_bind ;;
    7) wizard_http_port ;;
    8) wizard_expose_api ;;
    9) wizard_origin ;;
    10) wizard_secrets ;;
    11) wizard_summary ;;
    *) rc=0 ;;
  esac
  rc=$?
  set -e
  return "${rc}"
}

wizard_skip_paths() {
  [[ "${FOLIUM_STORAGE_KIND:-managed}" == "managed" ]]
}

run_wizard() {
  local step=0
  local rc=0
  FOLIUM_STORAGE_KIND="${FOLIUM_STORAGE_KIND:-managed}"
  FOLIUM_UI_NOCANCEL=0
  FOLIUM_UI_CANCEL_LABEL="Back"
  FOLIUM_UI_OK_LABEL="OK"
  while true; do
    if [[ "${FOLIUM_INTERRUPTED}" == "1" ]]; then
      exit 130
    fi
    rc=0
    wizard_dispatch "${step}" || rc=$?
    case "${rc}" in
      0)
        if [[ "${step}" -eq 11 ]]; then
          return 0
        fi
        step=$((step + 1))
        if [[ "${step}" -eq 4 ]] && wizard_skip_paths; then
          step=5
        fi
        ;;
      1)
        # Stay on this screen after a validation msgbox.
        ;;
      2)
        if [[ "${step}" -le 0 ]]; then
          step=0
        else
          step=$((step - 1))
          if [[ "${step}" -eq 4 ]] && wizard_skip_paths; then
            step=3
          fi
        fi
        ;;
      "${UI_CANCEL}")
        ui_session_end
        exit 0
        ;;
      130) exit 130 ;;
      *) abort "Unexpected installer state (${rc})." ;;
    esac
  done
}

apply_storage() {
  local path fst chown_now suggested_gid
  for path in "${FOLIUM_DOCS_PATH}" "${FOLIUM_CONSUME_PATH}" "${FOLIUM_EXPORT_PATH}" "${FOLIUM_PADDLE_PATH}"; do
    if [[ ! -d "${path}" ]]; then
      run_root mkdir -p "${path}"
    fi
    fst="$(storage_fstype "${path}" || true)"
    if storage_is_remote_fstype "${fst}"; then
      log_info "path ${path} fstype=${fst} (remote-backed, ok)"
    fi
    if storage_writable_by_app_user "${path}"; then
      continue
    fi
    chown_now=0
    if [[ "${FOLIUM_NONINTERACTIVE}" == "1" ]]; then
      chown_now=1
    else
      local choice=""
      FOLIUM_UI_NOCANCEL=1
      choice="$(ui_menu "${path} is not writable by UID ${FOLIUM_APP_UID} (the container user).

Allow chown ${FOLIUM_APP_UID}:${FOLIUM_APP_GID} on this directory? Folium will not chmod 777.

Ctrl+C cancels." \
        chown "chown ${FOLIUM_APP_UID}:${FOLIUM_APP_GID}" \
        abort "Abort install")"
      FOLIUM_UI_NOCANCEL=0
      if [[ "${choice}" == "chown" ]]; then
        chown_now=1
      else
        abort "Storage path ${path} is not writable by UID ${FOLIUM_APP_UID}."
      fi
    fi
    if [[ "${chown_now}" == "1" ]]; then
      run_root chown "${FOLIUM_APP_UID}:${FOLIUM_APP_GID}" "${path}"
    fi
    if storage_writable_by_app_user "${path}"; then
      continue
    fi
    suggested_gid="$(storage_gid_of "${path}" 2>/dev/null || true)"
    if [[ -n "${suggested_gid}" && "${suggested_gid}" != "${FOLIUM_APP_GID}" && -z "${FOLIUM_EXTRA_GID:-}" ]]; then
      if [[ "${FOLIUM_NONINTERACTIVE}" == "1" ]]; then
        FOLIUM_EXTRA_GID="${suggested_gid}"
        log_info "auto-selected extra GID ${suggested_gid} for ${path}"
      else
        local gid_choice=""
        FOLIUM_UI_NOCANCEL=1
        gid_choice="$(ui_menu "${path} is still not writable after chown.

Directory group GID is ${suggested_gid}. CIFS/NFS paths with mode 0770 often need group_add in Compose.

Add GID ${suggested_gid} as an extra container group?" \
          yes "Add GID ${suggested_gid}" \
          abort "Abort install")"
        FOLIUM_UI_NOCANCEL=0
        if [[ "${gid_choice}" == "yes" ]]; then
          FOLIUM_EXTRA_GID="${suggested_gid}"
        else
          abort "Storage path ${path} is not writable. Configure FOLIUM_EXTRA_GID for 0770 CIFS binds."
        fi
      fi
    fi
    if storage_writable_by_app_user "${path}"; then
      continue
    fi
    abort "Storage path ${path} is still not writable by UID ${FOLIUM_APP_UID}. For 0770 CIFS binds set FOLIUM_EXTRA_GID to the directory group GID."
  done
}

fetch_compose() {
  local dest="${FOLIUM_INSTALL_DIR}/docker-compose.yml"
  mkdir -p "${FOLIUM_INSTALL_DIR}"
  if [[ -n "${FOLIUM_RELEASE_COMPOSE_FILE:-}" ]]; then
    cp "${FOLIUM_RELEASE_COMPOSE_FILE}" "${dest}"
  else
    config_download "$(github_asset_url "${FOLIUM_VERSION_TAG}" "docker-compose.yml")" "${dest}"
  fi
  config_strip_compose_ports "${dest}"
}

prepare_source() {
  if ! require_cmd git; then
    ui_gauge_stop 2>/dev/null || true
    dep_install_git >>"${FOLIUM_LOG_FILE}" 2>&1 || abort "git is required to build from source."
  fi
  mkdir -p "${FOLIUM_INSTALL_DIR}"
  if [[ -d "${FOLIUM_INSTALL_DIR}/src/.git" ]]; then
    git -C "${FOLIUM_INSTALL_DIR}/src" fetch --tags >>"${FOLIUM_LOG_FILE}" 2>&1 \
      || abort "git fetch failed. See ${FOLIUM_LOG_FILE}."
    git -C "${FOLIUM_INSTALL_DIR}/src" checkout "${FOLIUM_VERSION_TAG}" >>"${FOLIUM_LOG_FILE}" 2>&1 \
      || abort "git checkout ${FOLIUM_VERSION_TAG} failed. See ${FOLIUM_LOG_FILE}."
  else
    rm -rf "${FOLIUM_INSTALL_DIR}/src"
    git clone --branch "${FOLIUM_VERSION_TAG}" --depth 1 \
      "${FOLIUM_GITHUB_URL}.git" "${FOLIUM_INSTALL_DIR}/src" >>"${FOLIUM_LOG_FILE}" 2>&1 \
      || abort "git clone failed. See ${FOLIUM_LOG_FILE}."
  fi
  config_write_source_overlay
}

install_cli() {
  mkdir -p "${FOLIUM_INSTALL_DIR}/installer"
  if [[ "${FOLIUM_PACKED:-0}" == "1" ]]; then
    folium_install_packed_ctl
  else
    cp -a "${INSTALLER_ROOT}/install.sh" "${FOLIUM_INSTALL_DIR}/installer/"
    cp -a "${INSTALLER_ROOT}/folium-ctl.sh" "${FOLIUM_INSTALL_DIR}/installer/"
    cp -a "${INSTALLER_ROOT}/lib" "${FOLIUM_INSTALL_DIR}/installer/"
    cp -a "${INSTALLER_ROOT}/templates" "${FOLIUM_INSTALL_DIR}/installer/"
    if [[ -f "${INSTALLER_ROOT}/pack.sh" ]]; then
      cp -a "${INSTALLER_ROOT}/pack.sh" "${FOLIUM_INSTALL_DIR}/installer/"
    fi
    run_root install -m 755 "${INSTALLER_ROOT}/folium-ctl.sh" /usr/local/bin/folium
  fi
  state_write_pointer
}

ensure_install_dir() {
  run_root mkdir -p "${FOLIUM_INSTALL_DIR}/backups" "${FOLIUM_INSTALL_DIR}/data"
  if ! is_root; then
    run_root chown "$(id -u):$(id -g)" "${FOLIUM_INSTALL_DIR}" "${FOLIUM_INSTALL_DIR}/backups" "${FOLIUM_INSTALL_DIR}/data"
  fi
}

run_install_cmd() {
  log_cmd "$*"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    "$@"
  else
    "$@" >>"${FOLIUM_LOG_FILE}" 2>&1
  fi
}

folium_health_progress() {
  local i="$1"
  local n="$2"
  local pct=$((75 + (i * 20 / n)))
  if [[ "${pct}" -gt 95 ]]; then
    pct=95
  fi
  ui_gauge_update "${pct}" "Waiting for health (${i}/${n})..."
}

execute_install() {
  log_info "execute_install method=${FOLIUM_METHOD} version=${FOLIUM_VERSION}"
  FOLIUM_API_PORT="${FOLIUM_API_PORT:-${FOLIUM_DEFAULT_API_PORT}}"
  ensure_install_dir
  if [[ "${FOLIUM_MODE}" == "reconfigure" ]]; then
    config_backup_install_dir
  fi
  apply_storage

  ui_gauge_start "Installing Folium ${FOLIUM_VERSION}..."
  ui_gauge_update 10 "Writing Compose files..."
  fetch_compose
  config_write_override
  if [[ "${FOLIUM_METHOD}" == "source" ]]; then
    ui_gauge_update 20 "Cloning source ${FOLIUM_VERSION_TAG}..."
    prepare_source
  else
    rm -f "${FOLIUM_INSTALL_DIR}/compose.source.yaml"
  fi
  ui_gauge_update 30 "Writing .env..."
  config_write_env
  if ! config_compose_validate; then
    ui_gauge_stop
    abort "docker compose config failed. See ${FOLIUM_LOG_FILE}."
  fi
  if [[ "${FOLIUM_METHOD}" == "source" ]]; then
    ui_gauge_update 40 "Building images (this may take several minutes)..."
    log_info "building images from source"
    if ! run_install_cmd folium_compose build; then
      ui_gauge_stop
      abort "Image build failed. See ${FOLIUM_LOG_FILE}."
    fi
  else
    ui_gauge_update 40 "Pulling images (this may take several minutes)..."
    log_info "pulling images"
    if ! run_install_cmd folium_compose pull; then
      ui_gauge_stop
      abort "Image pull failed. See ${FOLIUM_LOG_FILE}."
    fi
  fi
  ui_gauge_update 70 "Starting services..."
  if ! run_install_cmd folium_compose up -d; then
    ui_gauge_stop
    abort "docker compose up failed. See ${FOLIUM_LOG_FILE}."
  fi
  local healthy=1
  ui_gauge_update 75 "Waiting for health checks..."
  if ! health_wait; then
    healthy=0
  fi
  ui_gauge_update 96 "Writing install state..."
  state_write
  if [[ "${FOLIUM_SKIP_CLI:-0}" != "1" ]]; then
    ui_gauge_update 98 "Installing folium CLI..."
    install_cli
  fi
  ui_gauge_update 100 "Done."
  ui_gauge_stop
  FOLIUM_HEALTHY="${healthy}"
}

repair_install() {
  load_existing_defaults
  [[ -n "${FOLIUM_INSTALL_DIR:-}" ]] || abort "No install directory found."
  [[ -f "${FOLIUM_INSTALL_DIR}/docker-compose.yml" ]] || abort "No docker-compose.yml in ${FOLIUM_INSTALL_DIR}."
  ui_gauge_start "Repairing Folium..."
  ui_gauge_update 30 "Starting services..."
  if ! run_install_cmd folium_compose up -d; then
    ui_gauge_stop
    abort "Repair failed to start services. See ${FOLIUM_LOG_FILE}."
  fi
  ui_gauge_update 60 "Waiting for health..."
  local ok=0
  if health_wait; then
    ok=1
  fi
  ui_gauge_update 100 "Done."
  ui_gauge_stop
  if [[ "${ok}" == "1" ]]; then
    ui_msgbox "Repair finished. Folium is healthy.

UI: ${FOLIUM_FRONTEND_ORIGIN:-http://127.0.0.1:${FOLIUM_HTTP_PORT:-9398}}
CLI: folium status
Log: ${FOLIUM_LOG_FILE}"
  else
    ui_msgbox "Repair completed but Folium is not healthy yet.

See: ${FOLIUM_LOG_FILE}
Then: folium doctor"
  fi
}

update_install() {
  load_existing_defaults
  [[ -n "${FOLIUM_INSTALL_DIR:-}" ]] || abort "No install directory found."
  [[ -f "${FOLIUM_INSTALL_DIR}/.env" ]] || abort "No .env in ${FOLIUM_INSTALL_DIR}."
  [[ -f "${FOLIUM_INSTALL_DIR}/docker-compose.yml" ]] || abort "No docker-compose.yml in ${FOLIUM_INSTALL_DIR}."

  FOLIUM_MODE=update
  FOLIUM_METHOD=image
  SHOW_ADMIN_PASSWORD=0
  FOLIUM_BIND="${FOLIUM_BIND:-0.0.0.0}"
  FOLIUM_HTTP_PORT="${FOLIUM_HTTP_PORT:-${FOLIUM_DEFAULT_HTTP_PORT}}"
  FOLIUM_API_PORT="${FOLIUM_API_PORT:-${FOLIUM_DEFAULT_API_PORT}}"
  FOLIUM_COMPOSE_PROJECT="${FOLIUM_COMPOSE_PROJECT:-${FOLIUM_DEFAULT_PROJECT}}"
  FOLIUM_EXPOSE_API="${FOLIUM_EXPOSE_API:-0}"
  FOLIUM_FRONTEND_ORIGIN="$(config_env_get FRONTEND_ORIGIN || printf '%s' "${FOLIUM_FRONTEND_ORIGIN:-http://127.0.0.1:${FOLIUM_HTTP_PORT}}")"
  FOLIUM_DOCS_PATH="$(config_env_get FOLIUM_DOCUMENTS_HOST || printf '%s' "${FOLIUM_DOCS_PATH:-${FOLIUM_INSTALL_DIR}/data/documents}")"
  FOLIUM_CONSUME_PATH="$(config_env_get FOLIUM_CONSUME_HOST || printf '%s' "${FOLIUM_CONSUME_PATH:-${FOLIUM_INSTALL_DIR}/data/consume}")"
  FOLIUM_EXPORT_PATH="$(config_env_get FOLIUM_EXPORT_HOST || printf '%s' "${FOLIUM_EXPORT_PATH:-${FOLIUM_INSTALL_DIR}/data/export}")"
  FOLIUM_PADDLE_PATH="$(config_env_get FOLIUM_PADDLE_CACHE_HOST || printf '%s' "${FOLIUM_PADDLE_PATH:-${FOLIUM_INSTALL_DIR}/data/paddleocr}")"

  if [[ "${FOLIUM_NONINTERACTIVE}" == "1" ]]; then
    if ! config_resolve_version_tag; then
      abort "Could not resolve FOLIUM_VERSION / FOLIUM_VERSION_TAG to a pinned release."
    fi
    log_info "noninteractive update to ${FOLIUM_VERSION_TAG}"
  else
    local rc=0
    while true; do
      rc=0
      wizard_version || rc=$?
      case "${rc}" in
        0) break ;;
        1) continue ;;
        2)
          prompt_existing "${FOLIUM_INSTALL_DIR}"
          case "${FOLIUM_MODE}" in
            update) continue ;;
            repair) repair_install; return 0 ;;
            reconfigure) return 2 ;;
            *) return 0 ;;
          esac
          ;;
        130) exit 130 ;;
        *) abort "Unexpected update state (${rc})." ;;
      esac
    done

    local go=""
    go="$(ui_menu "Update Folium to ${FOLIUM_VERSION_TAG} (image tag ${FOLIUM_VERSION})?

Install dir: ${FOLIUM_INSTALL_DIR}
Secrets and document data are kept. Compose will pull release images and restart.

Log file:
${FOLIUM_LOG_FILE}" \
      update "Update now" \
      back "Back")" || return 2
    if [[ "${go}" != "update" ]]; then
      return 2
    fi
  fi

  config_backup_install_dir
  config_env_set FOLIUM_VERSION "${FOLIUM_VERSION}"
  rm -f "${FOLIUM_INSTALL_DIR}/compose.source.yaml"

  ui_gauge_start "Updating Folium to ${FOLIUM_VERSION}..."
  ui_gauge_update 15 "Downloading release Compose..."
  fetch_compose
  # Re-apply port/bind overlay from current settings (ports stay stripped on the base file).
  config_write_override
  if ! config_compose_validate; then
    ui_gauge_stop
    abort "docker compose config failed after update. See ${FOLIUM_LOG_FILE}."
  fi
  ui_gauge_update 40 "Pulling images..."
  if ! run_install_cmd folium_compose pull; then
    ui_gauge_stop
    abort "Image pull failed. See ${FOLIUM_LOG_FILE}."
  fi
  ui_gauge_update 70 "Restarting services..."
  if ! run_install_cmd folium_compose up -d; then
    ui_gauge_stop
    abort "docker compose up failed. See ${FOLIUM_LOG_FILE}."
  fi
  local healthy=1
  ui_gauge_update 75 "Waiting for health checks..."
  if ! health_wait; then
    healthy=0
  fi
  ui_gauge_update 96 "Writing install state..."
  state_write
  if [[ "${FOLIUM_SKIP_CLI:-0}" != "1" ]]; then
    ui_gauge_update 98 "Refreshing folium CLI..."
    install_cli
  fi
  ui_gauge_update 100 "Done."
  ui_gauge_stop
  FOLIUM_HEALTHY="${healthy}"
  FOLIUM_FRONTEND_ORIGIN="$(config_env_get FRONTEND_ORIGIN || printf '%s' "${FOLIUM_FRONTEND_ORIGIN:-}")"
  if [[ "${FOLIUM_NONINTERACTIVE}" != "1" ]]; then
    success_screen
  fi
  return 0
}

success_screen() {
  local admin_note="" mcp_note="" api_note=""
  local primary_origin="${FOLIUM_FRONTEND_ORIGIN%*,*}"
  primary_origin="${primary_origin%/}"
  mcp_note="

MCP (Bearer token): ${primary_origin}/mcp"
  if [[ "${FOLIUM_EXPOSE_API:-0}" == "1" ]]; then
    api_note="

API (optional): http://${FOLIUM_BIND}:${FOLIUM_API_PORT:-${FOLIUM_DEFAULT_API_PORT}}/mcp"
  fi
  if [[ "${SHOW_ADMIN_PASSWORD}" == "1" ]]; then
    admin_note="

Admin username: ${FOLIUM_ADMIN_USERNAME:-admin}
Admin password: ${FOLIUM_ADMIN_PASSWORD}

Save this password now. It will not be shown again and is not written to the installer log."
  else
    admin_note="

Existing admin credentials were kept and are not displayed."
  fi
  if [[ "${FOLIUM_HEALTHY:-1}" == "1" ]]; then
    local verb="installed"
    [[ "${FOLIUM_MODE}" == "update" ]] && verb="updated"
    ui_msgbox "Folium ${FOLIUM_VERSION} is ${verb} and healthy.

Open: ${FOLIUM_FRONTEND_ORIGIN}${mcp_note}${api_note}
Install dir: ${FOLIUM_INSTALL_DIR}
CLI: folium status | start | stop | logs | doctor
Log: ${FOLIUM_LOG_FILE}${admin_note}"
  else
    local verb="Install"
    [[ "${FOLIUM_MODE}" == "update" ]] && verb="Update"
    ui_msgbox "${verb} completed but Folium is not healthy yet.

Open: ${FOLIUM_FRONTEND_ORIGIN}${mcp_note}${api_note}
Install dir: ${FOLIUM_INSTALL_DIR}
Log: ${FOLIUM_LOG_FILE}
Next: folium doctor

Do not treat this as a successful install until health checks pass.${admin_note}"
  fi
}

main() {
  parse_args "$@"
  log_init
  log_info "installer root=${INSTALLER_ROOT}"

  ensure_whiptail

  local discovered=""
  discovered="$(discover_existing_install || true)"

  if [[ "${FOLIUM_NONINTERACTIVE}" != "1" ]]; then
    ui_session_start
    local welcome_extra=""
    if [[ -n "${discovered}" ]]; then
      welcome_extra="

Folium is already installed at:
${discovered}"
    fi
    ui_msgbox "Welcome to the Folium installer.

This will install or update a Docker Compose stack (Postgres, API, worker, web).
AI providers are optional and are not configured here.
${welcome_extra}

Installation log file:
${FOLIUM_LOG_FILE}

Use Back to return to the previous screen.
Ctrl+C cancels; existing data is not deleted."
  fi

  SYSTEM_CHECK_WARNINGS=""
  if ! system_check; then
    abort "${SYSTEM_CHECK_ERROR}"
  fi
  if [[ -n "${SYSTEM_CHECK_WARNINGS:-}" && "${FOLIUM_NONINTERACTIVE}" != "1" ]]; then
    ui_msgbox "Warnings:
${SYSTEM_CHECK_WARNINGS}

You can continue, but performance or disk space may be tight."
  fi

  ensure_docker_ready

  if [[ "${FOLIUM_NONINTERACTIVE}" == "1" ]]; then
    FOLIUM_METHOD="${FOLIUM_METHOD:-image}"
    FOLIUM_INSTALL_DIR="${FOLIUM_INSTALL_DIR:-${FOLIUM_DEFAULT_INSTALL_DIR}}"
    FOLIUM_INSTALL_DIR="$(storage_normalize_path "${FOLIUM_INSTALL_DIR}")"
    if storage_is_critical_forbidden_path "${FOLIUM_INSTALL_DIR}"; then
      abort "Refusing to install into ${FOLIUM_INSTALL_DIR}."
    fi
    if ! storage_validate_install_path "${FOLIUM_INSTALL_DIR}"; then
      abort "Refusing risky install path ${FOLIUM_INSTALL_DIR}. Set FOLIUM_ACCEPT_RISKY_PATH=1 to allow /root or /tmp."
    fi

    # Prefer discovered install path when updating (or when one already exists).
    if [[ -z "${discovered}" ]]; then
      discovered="$(discover_existing_install || true)"
    fi
    if [[ -z "${discovered}" \
      && -f "${FOLIUM_INSTALL_DIR}/.env" \
      && -f "${FOLIUM_INSTALL_DIR}/docker-compose.yml" ]]; then
      discovered="${FOLIUM_INSTALL_DIR}"
    fi
    local want_update=0
    if [[ "${FOLIUM_MODE}" == "update" ]]; then
      want_update=1
    elif [[ -n "${discovered}" ]]; then
      # Default: existing install → update (preserve secrets/bind).
      want_update=1
    fi

    if [[ "${want_update}" == "1" ]]; then
      if [[ -z "${discovered}" ]]; then
        abort "No existing Folium install found to update. Set FOLIUM_INSTALL_DIR or install first."
      fi
      FOLIUM_INSTALL_DIR="${discovered}"
      FOLIUM_MODE=update
      update_install
      finish_noninteractive
    fi

    FOLIUM_MODE=install
    # Fresh install defaults (only applied when not already set via env / --preserve-secrets path).
    if [[ -f "${FOLIUM_INSTALL_DIR}/.env" ]]; then
      load_existing_defaults
    fi
    FOLIUM_BIND="${FOLIUM_BIND:-127.0.0.1}"
    FOLIUM_HTTP_PORT="${FOLIUM_HTTP_PORT:-${FOLIUM_DEFAULT_HTTP_PORT}}"
    FOLIUM_API_PORT="${FOLIUM_API_PORT:-${FOLIUM_DEFAULT_API_PORT}}"
    FOLIUM_EXPOSE_API="${FOLIUM_EXPOSE_API:-0}"
    FOLIUM_COMPOSE_PROJECT="${FOLIUM_COMPOSE_PROJECT:-${FOLIUM_DEFAULT_PROJECT}}"
    if ! config_resolve_version_tag; then
      abort "Non-interactive install requires a pinned FOLIUM_VERSION / FOLIUM_VERSION_TAG (or latest/beta)."
    fi
    FOLIUM_DOCS_PATH="${FOLIUM_DOCS_PATH:-${FOLIUM_INSTALL_DIR}/data/documents}"
    FOLIUM_CONSUME_PATH="${FOLIUM_CONSUME_PATH:-${FOLIUM_INSTALL_DIR}/data/consume}"
    FOLIUM_EXPORT_PATH="${FOLIUM_EXPORT_PATH:-${FOLIUM_INSTALL_DIR}/data/export}"
    FOLIUM_PADDLE_PATH="${FOLIUM_PADDLE_PATH:-${FOLIUM_INSTALL_DIR}/data/paddleocr}"
    local bind_path
    for bind_path in "${FOLIUM_DOCS_PATH}" "${FOLIUM_CONSUME_PATH}" "${FOLIUM_EXPORT_PATH}" "${FOLIUM_PADDLE_PATH}"; do
      if ! storage_validate_bind_path "${bind_path}"; then
        abort "Refusing storage bind path ${bind_path}."
      fi
    done
    FOLIUM_FRONTEND_ORIGIN="${FOLIUM_FRONTEND_ORIGIN:-$(network_origin_for "${FOLIUM_BIND}" "${FOLIUM_HTTP_PORT}" "")}"
    wizard_secrets
    execute_install
    finish_noninteractive
  fi

  # Prefer the path discovered on the welcome screen; re-check after Docker is ready.
  if [[ -z "${discovered}" ]]; then
    discovered="$(discover_existing_install || true)"
  fi

  if [[ -n "${discovered}" ]]; then
    FOLIUM_INSTALL_DIR="${discovered}"
    while true; do
      prompt_existing "${discovered}"
      case "${FOLIUM_MODE}" in
        update)
          local urc=0
          update_install || urc=$?
          case "${urc}" in
            0)
              ui_session_end
              return 0
              ;;
            2)
              # Nested Back may have switched mode via prompt_existing.
              case "${FOLIUM_MODE}" in
                reconfigure)
                  load_existing_defaults
                  break
                  ;;
                repair)
                  repair_install
                  ui_session_end
                  return 0
                  ;;
                *)
                  continue
                  ;;
              esac
              ;;
            130) exit 130 ;;
            *) abort "Update failed." ;;
          esac
          ;;
        repair)
          repair_install
          ui_session_end
          return 0
          ;;
        reconfigure)
          load_existing_defaults
          break
          ;;
        *)
          ui_session_end
          return 0
          ;;
      esac
    done
  fi

  run_wizard
  execute_install
  success_screen
  ui_session_end
}

trap on_interrupt INT TERM
main "$@"
