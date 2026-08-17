#!/usr/bin/env bash
# Folium interactive installer (whiptail TUI).
# shellcheck disable=SC1091
set -euo pipefail

INSTALLER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export INSTALLER_ROOT

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

FOLIUM_NONINTERACTIVE="${FOLIUM_NONINTERACTIVE:-0}"
FOLIUM_KEEP_SECRETS="${FOLIUM_KEEP_SECRETS:-0}"
FOLIUM_MODE="${FOLIUM_MODE:-install}"
SHOW_ADMIN_PASSWORD=0

on_interrupt() {
  stty sane 2>/dev/null || true
  printf '\nInstall cancelled. Existing data was not deleted.\n' >&2
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
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s\n' "${msg}" >&2
  else
    ui_msgbox "${msg}"
  fi
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
  if ! ui_yesno "Docker Engine is not running (or Compose is missing).

Folium can run Docker's official install script (get.docker.com). This requires root, adds Docker's apt/yum repository, and starts the docker service.

Install Docker Engine now?"; then
    abort "Docker is required. Install Docker, then re-run this installer."
  fi
  if ! dep_install_docker_engine; then
    abort "Docker installation failed. See ${FOLIUM_LOG_FILE}."
  fi
  if ! docker_info_ok || ! docker_compose_ok; then
    abort "Docker is installed but not usable yet. You may need to log out and back in, then re-run the installer."
  fi
}

prompt_existing() {
  local dir="$1"
  local choice
  choice="$(ui_menu "Folium files were found in ${dir}.

Reconfigure walks through settings again (existing .env is backed up; secrets are kept unless you rotate them).
Repair restarts the stack and waits for health without rewriting .env.
Exit leaves everything unchanged." \
    reconfigure "Reconfigure" \
    repair "Repair (re-up + health)" \
    exit "Exit")" || exit 130
  case "${choice}" in
    reconfigure) FOLIUM_MODE=reconfigure ;;
    repair) FOLIUM_MODE=repair ;;
    *) exit 0 ;;
  esac
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
    FOLIUM_COMPOSE_PROJECT="$(config_env_get COMPOSE_PROJECT_NAME || printf '%s' "${FOLIUM_COMPOSE_PROJECT:-}")"
    FOLIUM_DOCS_PATH="$(config_env_get FOLIUM_DOCUMENTS_HOST || printf '%s' "${FOLIUM_DOCS_PATH:-}")"
    FOLIUM_CONSUME_PATH="$(config_env_get FOLIUM_CONSUME_HOST || printf '%s' "${FOLIUM_CONSUME_PATH:-}")"
    FOLIUM_EXPORT_PATH="$(config_env_get FOLIUM_EXPORT_HOST || printf '%s' "${FOLIUM_EXPORT_PATH:-}")"
    FOLIUM_PADDLE_PATH="$(config_env_get FOLIUM_PADDLE_CACHE_HOST || printf '%s' "${FOLIUM_PADDLE_PATH:-}")"
  fi
}

wizard_method() {
  local choice
  choice="$(ui_menu "How should Folium be installed?

Pre-built images pull ghcr.io/brocxftw/folium-* for the selected release (recommended).
Build from source clones that release tag and builds images locally. Git is required." \
    image "Pre-built image (recommended)" \
    source "Build from source")" || return 1
  FOLIUM_METHOD="${choice}"
}

wizard_version() {
  local latest tags choice
  latest="$(github_latest_tag || true)"
  if [[ -z "${latest}" ]]; then
    FOLIUM_VERSION_TAG="$(ui_input "Could not list GitHub Releases. Enter a version tag (for example v0.1.16):" "v0.1.16")" || return 1
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
    choice="$(ui_menu "Select a Folium release. The installer pins this version (never stores 'latest')." "${menu_items[@]}")" || return 1
    FOLIUM_VERSION_TAG="${choice}"
  fi
  FOLIUM_VERSION="$(config_strip_v_prefix "${FOLIUM_VERSION_TAG}")"
  if [[ "${FOLIUM_VERSION}" == "latest" ]] || ! config_is_pinned_version "${FOLIUM_VERSION}"; then
    abort "Refusing to install an unpinned version (${FOLIUM_VERSION_TAG}). Choose a vX.Y.Z release."
  fi
}

wizard_directory() {
  local dir
  dir="$(ui_input "Install directory:" "${FOLIUM_INSTALL_DIR:-${FOLIUM_DEFAULT_INSTALL_DIR}}")" || return 1
  dir="$(storage_normalize_path "${dir}")"
  if storage_is_forbidden_path "${dir}"; then
    abort "Refusing to install into ${dir}."
  fi
  FOLIUM_INSTALL_DIR="${dir}"
  FOLIUM_COMPOSE_PROJECT="${FOLIUM_COMPOSE_PROJECT:-${FOLIUM_DEFAULT_PROJECT}}"
}

wizard_storage() {
  local choice docs consume export_path extra
  choice="$(ui_menu "Where should document files live?

Managed directories are created under the install directory.
Existing host paths are used as-is (including NFS/CIFS mounts already on this host). The installer will not edit /etc/fstab." \
    managed "Managed paths under the install directory" \
    existing "Use existing host paths")" || return 1
  if [[ "${choice}" == "managed" ]]; then
    docs="${FOLIUM_INSTALL_DIR}/data/documents"
    consume="${FOLIUM_INSTALL_DIR}/data/consume"
    export_path="${FOLIUM_INSTALL_DIR}/data/export"
  else
    docs="$(ui_input "Documents host path:" "${FOLIUM_DOCS_PATH:-${FOLIUM_INSTALL_DIR}/data/documents}")" || return 1
    consume="$(ui_input "Consume (drop folder) host path:" "${FOLIUM_CONSUME_PATH:-${FOLIUM_INSTALL_DIR}/data/consume}")" || return 1
    export_path="$(ui_input "Export host path:" "${FOLIUM_EXPORT_PATH:-${FOLIUM_INSTALL_DIR}/data/export}")" || return 1
  fi
  FOLIUM_DOCS_PATH="$(storage_normalize_path "${docs}")"
  FOLIUM_CONSUME_PATH="$(storage_normalize_path "${consume}")"
  FOLIUM_EXPORT_PATH="$(storage_normalize_path "${export_path}")"
  FOLIUM_PADDLE_PATH="${FOLIUM_INSTALL_DIR}/data/paddleocr"
  local p
  for p in "${FOLIUM_DOCS_PATH}" "${FOLIUM_CONSUME_PATH}" "${FOLIUM_EXPORT_PATH}" "${FOLIUM_PADDLE_PATH}"; do
    if storage_is_forbidden_path "${p}"; then
      abort "Refusing storage path ${p}."
    fi
  done
  extra="$(ui_input "Optional extra host GID for 0770 CIFS binds (leave empty for none):" "${FOLIUM_EXTRA_GID:-}")" || return 1
  if [[ -n "${extra}" && ! "${extra}" =~ ^[0-9]+$ ]]; then
    abort "Extra GID must be numeric."
  fi
  FOLIUM_EXTRA_GID="${extra}"
}

wizard_network() {
  local bind_choice port origin
  bind_choice="$(ui_menu "Who should be able to open the UI?

LAN bind (0.0.0.0) listens on all interfaces.
Localhost (127.0.0.1) is for this host or a reverse proxy on the same machine." \
    lan "LAN — bind 0.0.0.0" \
    local "Localhost — bind 127.0.0.1")" || return 1
  if [[ "${bind_choice}" == "local" ]]; then
    FOLIUM_BIND="127.0.0.1"
  else
    FOLIUM_BIND="0.0.0.0"
  fi
  port="$(ui_input "HTTP port for the UI:" "${FOLIUM_HTTP_PORT:-${FOLIUM_DEFAULT_HTTP_PORT}}")" || return 1
  if ! network_port_valid "${port}"; then
    abort "Invalid port: ${port}"
  fi
  if network_port_in_use "${port}" && ! network_port_is_ours "${port}"; then
    abort "Port ${port} is already in use:

$(network_port_users "${port}")"
  fi
  FOLIUM_HTTP_PORT="${port}"
  FOLIUM_EXPOSE_API=0
  if ui_yesno "Publish the API/OpenAPI port 8000 on ${FOLIUM_BIND} as well?

The UI already proxies /api and /health. Leave this off unless you need http://${FOLIUM_BIND}:8000/docs from other hosts."; then
    if network_port_in_use 8000 && ! network_port_is_ours 8000; then
      abort "Port 8000 is already in use."
    fi
    FOLIUM_EXPOSE_API=1
  fi
  origin=""
  if ui_yesno "Will you reach Folium through a reverse proxy or public hostname?

If yes, you will enter the public URL (for example https://docs.example.com). This installer does not install Caddy or nginx on the host."; then
    origin="$(ui_input "Public URL (FRONTEND_ORIGIN):" "https://docs.example.com")" || return 1
  fi
  FOLIUM_FRONTEND_ORIGIN="$(network_origin_for "${FOLIUM_BIND}" "${FOLIUM_HTTP_PORT}" "${origin}")"
  FOLIUM_FRONTEND_ORIGIN="$(ui_input "Confirm the browser origin (must match the URL you open):" "${FOLIUM_FRONTEND_ORIGIN}")" || return 1
}

wizard_secrets() {
  FOLIUM_ADMIN_USERNAME="${FOLIUM_ADMIN_USERNAME:-admin}"
  if [[ "${FOLIUM_KEEP_SECRETS}" == "1" && -n "${FOLIUM_SECRET_KEY:-}" ]]; then
    if [[ "${FOLIUM_NONINTERACTIVE}" == "1" ]] || ui_yesno "Keep existing secrets and admin password in .env?

Choosing No generates new keys. That does not rotate an already-bootstrapped admin account."; then
      SHOW_ADMIN_PASSWORD=0
      return 0
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
}

collect_config() {
  wizard_method
  wizard_version
  wizard_directory
  wizard_storage
  wizard_network
  wizard_secrets
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
    elif ui_yesno "${path} is not writable by UID ${FOLIUM_APP_UID} (the container user).

Allow chown ${FOLIUM_APP_UID}:${FOLIUM_APP_GID} on this directory? Folium will not chmod 777."; then
      chown_now=1
    else
      abort "Storage path ${path} is not writable by UID ${FOLIUM_APP_UID}."
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
  dep_install_git || abort "git is required to build from source."
  mkdir -p "${FOLIUM_INSTALL_DIR}"
  if [[ -d "${FOLIUM_INSTALL_DIR}/src/.git" ]]; then
    git -C "${FOLIUM_INSTALL_DIR}/src" fetch --tags
    git -C "${FOLIUM_INSTALL_DIR}/src" checkout "${FOLIUM_VERSION_TAG}"
  else
    rm -rf "${FOLIUM_INSTALL_DIR}/src"
    git clone --branch "${FOLIUM_VERSION_TAG}" --depth 1 \
      "${FOLIUM_GITHUB_URL}.git" "${FOLIUM_INSTALL_DIR}/src"
  fi
  config_write_source_overlay
}

install_cli() {
  mkdir -p "${FOLIUM_INSTALL_DIR}/installer"
  cp -a "${INSTALLER_ROOT}/install.sh" "${FOLIUM_INSTALL_DIR}/installer/"
  cp -a "${INSTALLER_ROOT}/get.sh" "${FOLIUM_INSTALL_DIR}/installer/"
  cp -a "${INSTALLER_ROOT}/folium-ctl.sh" "${FOLIUM_INSTALL_DIR}/installer/"
  cp -a "${INSTALLER_ROOT}/lib" "${FOLIUM_INSTALL_DIR}/installer/"
  cp -a "${INSTALLER_ROOT}/templates" "${FOLIUM_INSTALL_DIR}/installer/"
  run_root install -m 755 "${INSTALLER_ROOT}/folium-ctl.sh" /usr/local/bin/folium
  state_write_pointer
}

ensure_install_dir() {
  run_root mkdir -p "${FOLIUM_INSTALL_DIR}/backups" "${FOLIUM_INSTALL_DIR}/data"
  if ! is_root; then
    run_root chown "$(id -u):$(id -g)" "${FOLIUM_INSTALL_DIR}" "${FOLIUM_INSTALL_DIR}/backups" "${FOLIUM_INSTALL_DIR}/data"
  fi
}

execute_install() {
  log_info "execute_install method=${FOLIUM_METHOD} version=${FOLIUM_VERSION}"
  ensure_install_dir
  if [[ "${FOLIUM_MODE}" == "reconfigure" ]]; then
    config_backup_install_dir
  fi
  apply_storage
  fetch_compose
  config_write_override
  if [[ "${FOLIUM_METHOD}" == "source" ]]; then
    prepare_source
  else
    rm -f "${FOLIUM_INSTALL_DIR}/compose.source.yaml"
  fi
  config_write_env
  if ! config_compose_validate; then
    abort "docker compose config failed. See ${FOLIUM_LOG_FILE}."
  fi
  ui_infobox "Starting Folium. This may take several minutes. Log: ${FOLIUM_LOG_FILE}"
  if [[ "${FOLIUM_METHOD}" == "source" ]]; then
    log_info "building images from source"
    folium_compose build
  else
    log_info "pulling images"
    folium_compose pull
  fi
  folium_compose up -d
  local healthy=1
  if ! health_wait; then
    healthy=0
  fi
  state_write
  if [[ "${FOLIUM_SKIP_CLI:-0}" != "1" ]]; then
    install_cli
  fi
  FOLIUM_HEALTHY="${healthy}"
}

repair_install() {
  load_existing_defaults
  [[ -n "${FOLIUM_INSTALL_DIR:-}" ]] || abort "No install directory found."
  [[ -f "${FOLIUM_INSTALL_DIR}/docker-compose.yml" ]] || abort "No docker-compose.yml in ${FOLIUM_INSTALL_DIR}."
  ui_infobox "Repairing Folium in ${FOLIUM_INSTALL_DIR}"
  folium_compose up -d
  if health_wait; then
    ui_msgbox "Repair finished. Folium is healthy.

UI: ${FOLIUM_FRONTEND_ORIGIN:-http://127.0.0.1:${FOLIUM_HTTP_PORT:-8080}}
CLI: folium status"
  else
    ui_msgbox "Repair completed but Folium is not healthy yet.

See: ${FOLIUM_LOG_FILE}
Then: folium doctor"
  fi
}

success_screen() {
  local extra=""
  if [[ "${SHOW_ADMIN_PASSWORD}" == "1" ]]; then
    extra="

Admin username: ${FOLIUM_ADMIN_USERNAME:-admin}
Admin password: ${FOLIUM_ADMIN_PASSWORD}

Save this password now. It will not be shown again and is not written to the installer log."
  else
    extra="

Existing admin credentials were kept and are not displayed."
  fi
  if [[ "${FOLIUM_HEALTHY:-1}" == "1" ]]; then
    ui_msgbox "Folium ${FOLIUM_VERSION} is installed and healthy.

Open: ${FOLIUM_FRONTEND_ORIGIN}
Install dir: ${FOLIUM_INSTALL_DIR}
CLI: folium status | start | stop | logs | doctor
Log: ${FOLIUM_LOG_FILE}${extra}"
  else
    ui_msgbox "Install completed but Folium is not healthy yet.

Open: ${FOLIUM_FRONTEND_ORIGIN}
Install dir: ${FOLIUM_INSTALL_DIR}
Log: ${FOLIUM_LOG_FILE}
Next: folium doctor

Do not treat this as a successful install until health checks pass.${extra}"
  fi
}

main() {
  parse_args "$@"
  log_init
  trap on_interrupt INT TERM
  log_info "installer root=${INSTALLER_ROOT}"

  ensure_whiptail
  if [[ "${FOLIUM_NONINTERACTIVE}" != "1" ]]; then
    ui_msgbox "Welcome to the Folium installer.

This will install a Docker Compose stack (Postgres, API, worker, web).
AI providers are optional and are not configured here.

A log is written to a temp file with secrets redacted."
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

  local discovered=""
  discovered="$(state_discover_dir || true)"
  if [[ -z "${discovered}" && -f "${FOLIUM_DEFAULT_INSTALL_DIR}/docker-compose.yml" ]]; then
    discovered="${FOLIUM_DEFAULT_INSTALL_DIR}"
  fi
  if [[ -n "${discovered}" ]]; then
    FOLIUM_INSTALL_DIR="${discovered}"
    prompt_existing "${discovered}"
    if [[ "${FOLIUM_MODE}" == "repair" ]]; then
      repair_install
      return 0
    fi
    load_existing_defaults
  fi

  while true; do
    collect_config
    local summary_file
    summary_file="$(mktemp)"
    config_render_summary >"${summary_file}"
    ui_textbox_file "${summary_file}" || true
    rm -f "${summary_file}"
    local go
    go="$(ui_menu "Proceed with installation?" install "Install" back "Back" cancel "Cancel")" || exit 130
    case "${go}" in
      install) break ;;
      back) continue ;;
      *) exit 0 ;;
    esac
  done

  execute_install
  success_screen
}

main "$@"
