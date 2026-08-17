#!/usr/bin/env bash
# Folium interactive installer (whiptail TUI).
# shellcheck disable=SC1091
set -euo pipefail

INSTALLER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export INSTALLER_ROOT

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
FOLIUM_MODE="${FOLIUM_MODE:-install}"
SHOW_ADMIN_PASSWORD=0

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
Usage: install.sh [--noninteractive] [--help]

Interactive (default): whiptail TUI that writes an install directory,
Compose overlay, and .env, then pulls or builds images and waits for health.

Non-interactive: set FOLIUM_* variables (see docs/deployment/installer.md).
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
    FOLIUM_VERSION_TAG="$(ui_input "Could not list GitHub Releases. Enter a version tag (for example v0.1.17):" "${FOLIUM_VERSION_TAG:-v0.1.17}")" || return "${UI_BACK}"
  else
    tags="$(github_release_tags || printf '%s\n' "${latest}")"
    local -a menu_items=()
    local tag
    while IFS= read -r tag; do
      [[ -n "${tag}" ]] || continue
      if [[ "${tag}" == "${latest}" ]]; then
        menu_items+=("${tag}" "Latest stable")
      else
        menu_items+=("${tag}" "${tag}")
      fi
    done <<<"${tags}"
    choice="$(ui_menu "Select a Folium release. The installer pins this version (never stores 'latest')." "${menu_items[@]}")" || return "${UI_BACK}"
    FOLIUM_VERSION_TAG="${choice}"
  fi
  FOLIUM_VERSION="$(config_strip_v_prefix "${FOLIUM_VERSION_TAG}")"
  if [[ "${FOLIUM_VERSION}" == "latest" ]] || ! config_is_pinned_version "${FOLIUM_VERSION}"; then
    ui_msgbox "Refusing to install an unpinned version (${FOLIUM_VERSION_TAG}). Choose a vX.Y.Z release."
    return 1
  fi
  return "${UI_OK}"
}

wizard_directory() {
  local dir=""
  dir="$(ui_input "Install directory:" "${FOLIUM_INSTALL_DIR:-${FOLIUM_DEFAULT_INSTALL_DIR}}")" || return "${UI_BACK}"
  dir="$(storage_normalize_path "${dir}")"
  if storage_is_forbidden_path "${dir}"; then
    ui_msgbox "Refusing to install into ${dir}. Choose another directory."
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
    if storage_is_forbidden_path "${p}"; then
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
  FOLIUM_API_PORT="${FOLIUM_API_PORT:-8000}"
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
  local port="${FOLIUM_API_PORT:-8000}"
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

wizard_reverse_proxy() {
  local choice=""
  choice="$(ui_menu "Will you reach Folium through a reverse proxy or public hostname?

If yes, you will enter the public URL (for example https://docs.example.com). This installer does not install Caddy or nginx on the host." \
    no "No — use the bind address" \
    yes "Yes — I have a public URL" \
    back "Back")" || return "${UI_BACK}"
  if [[ "${choice}" == "back" ]]; then
    return "${UI_BACK}"
  fi
  FOLIUM_USE_PROXY="${choice}"
  return "${UI_OK}"
}

wizard_origin() {
  local origin=""
  if [[ "${FOLIUM_USE_PROXY:-no}" == "yes" ]]; then
    origin="$(ui_input "Public URL (FRONTEND_ORIGIN):" "${FOLIUM_FRONTEND_ORIGIN:-https://docs.example.com}")" || return "${UI_BACK}"
  else
    origin="$(network_origin_for "${FOLIUM_BIND}" "${FOLIUM_HTTP_PORT}" "")"
  fi
  FOLIUM_FRONTEND_ORIGIN="$(ui_input "Confirm the browser origin (must match the URL you open):" "${origin}")" || return "${UI_BACK}"
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
  local summary_file go=""
  summary_file="$(mktemp)"
  config_render_summary >"${summary_file}"
  ui_textbox_file "${summary_file}" || {
    rm -f "${summary_file}"
    return "${UI_BACK}"
  }
  rm -f "${summary_file}"
  go="$(ui_menu "Proceed with installation?

Back returns to the previous settings screen. Ctrl+C cancels." \
    install "Install" \
    back "Back")" || return "${UI_BACK}"
  case "${go}" in
    install) return "${UI_OK}" ;;
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
    9) wizard_reverse_proxy ;;
    10) wizard_origin ;;
    11) wizard_secrets ;;
    12) wizard_summary ;;
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
  FOLIUM_USE_PROXY="${FOLIUM_USE_PROXY:-no}"
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
        if [[ "${step}" -eq 12 ]]; then
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
      130) exit 130 ;;
      *) abort "Unexpected installer state (${rc})." ;;
    esac
  done
}

apply_storage() {
  local path fst chown_now
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
    if ! storage_writable_by_app_user "${path}"; then
      abort "Storage path ${path} is still not writable by UID ${FOLIUM_APP_UID}."
    fi
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
  FOLIUM_API_PORT="${FOLIUM_API_PORT:-8000}"
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

UI: ${FOLIUM_FRONTEND_ORIGIN:-http://127.0.0.1:${FOLIUM_HTTP_PORT:-8080}}
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

  FOLIUM_METHOD=image
  SHOW_ADMIN_PASSWORD=0
  FOLIUM_BIND="${FOLIUM_BIND:-0.0.0.0}"
  FOLIUM_HTTP_PORT="${FOLIUM_HTTP_PORT:-${FOLIUM_DEFAULT_HTTP_PORT}}"
  FOLIUM_API_PORT="${FOLIUM_API_PORT:-8000}"
  FOLIUM_COMPOSE_PROJECT="${FOLIUM_COMPOSE_PROJECT:-${FOLIUM_DEFAULT_PROJECT}}"
  FOLIUM_EXPOSE_API="${FOLIUM_EXPOSE_API:-0}"
  FOLIUM_FRONTEND_ORIGIN="$(config_env_get FRONTEND_ORIGIN || printf '%s' "${FOLIUM_FRONTEND_ORIGIN:-http://127.0.0.1:${FOLIUM_HTTP_PORT}}")"
  FOLIUM_DOCS_PATH="$(config_env_get FOLIUM_DOCUMENTS_HOST || printf '%s' "${FOLIUM_DOCS_PATH:-${FOLIUM_INSTALL_DIR}/data/documents}")"
  FOLIUM_CONSUME_PATH="$(config_env_get FOLIUM_CONSUME_HOST || printf '%s' "${FOLIUM_CONSUME_PATH:-${FOLIUM_INSTALL_DIR}/data/consume}")"
  FOLIUM_EXPORT_PATH="$(config_env_get FOLIUM_EXPORT_HOST || printf '%s' "${FOLIUM_EXPORT_PATH:-${FOLIUM_INSTALL_DIR}/data/export}")"
  FOLIUM_PADDLE_PATH="$(config_env_get FOLIUM_PADDLE_CACHE_HOST || printf '%s' "${FOLIUM_PADDLE_PATH:-${FOLIUM_INSTALL_DIR}/data/paddleocr}")"
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
  success_screen
  return 0
}

success_screen() {
  local admin_note=""
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

Open: ${FOLIUM_FRONTEND_ORIGIN}
Install dir: ${FOLIUM_INSTALL_DIR}
CLI: folium status | start | stop | logs | doctor
Log: ${FOLIUM_LOG_FILE}${admin_note}"
  else
    local verb="Install"
    [[ "${FOLIUM_MODE}" == "update" ]] && verb="Update"
    ui_msgbox "${verb} completed but Folium is not healthy yet.

Open: ${FOLIUM_FRONTEND_ORIGIN}
Install dir: ${FOLIUM_INSTALL_DIR}
Log: ${FOLIUM_LOG_FILE}
Next: folium doctor

Do not treat this as a successful install until health checks pass.${admin_note}"
  fi
}

main() {
  parse_args "$@"
  log_init
  trap on_interrupt INT TERM
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
    FOLIUM_BIND="${FOLIUM_BIND:-127.0.0.1}"
    FOLIUM_HTTP_PORT="${FOLIUM_HTTP_PORT:-${FOLIUM_DEFAULT_HTTP_PORT}}"
    FOLIUM_API_PORT="${FOLIUM_API_PORT:-8000}"
    FOLIUM_EXPOSE_API="${FOLIUM_EXPOSE_API:-0}"
    FOLIUM_COMPOSE_PROJECT="${FOLIUM_COMPOSE_PROJECT:-${FOLIUM_DEFAULT_PROJECT}}"
    if [[ -z "${FOLIUM_VERSION_TAG:-}" ]]; then
      if [[ -n "${FOLIUM_VERSION:-}" ]]; then
        FOLIUM_VERSION_TAG="v$(config_strip_v_prefix "${FOLIUM_VERSION}")"
      else
        FOLIUM_VERSION_TAG="$(github_latest_tag)"
      fi
    fi
    FOLIUM_VERSION="$(config_strip_v_prefix "${FOLIUM_VERSION:-${FOLIUM_VERSION_TAG}}")"
    if [[ "${FOLIUM_VERSION}" == "latest" ]] || ! config_is_pinned_version "${FOLIUM_VERSION}"; then
      abort "Non-interactive install requires a pinned FOLIUM_VERSION / FOLIUM_VERSION_TAG."
    fi
    FOLIUM_DOCS_PATH="${FOLIUM_DOCS_PATH:-${FOLIUM_INSTALL_DIR}/data/documents}"
    FOLIUM_CONSUME_PATH="${FOLIUM_CONSUME_PATH:-${FOLIUM_INSTALL_DIR}/data/consume}"
    FOLIUM_EXPORT_PATH="${FOLIUM_EXPORT_PATH:-${FOLIUM_INSTALL_DIR}/data/export}"
    FOLIUM_PADDLE_PATH="${FOLIUM_PADDLE_PATH:-${FOLIUM_INSTALL_DIR}/data/paddleocr}"
    FOLIUM_FRONTEND_ORIGIN="${FOLIUM_FRONTEND_ORIGIN:-$(network_origin_for "${FOLIUM_BIND}" "${FOLIUM_HTTP_PORT}" "")}"
    wizard_secrets
    execute_install
    success_screen
    return 0
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

main "$@"
