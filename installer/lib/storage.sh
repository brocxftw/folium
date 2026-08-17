# Host path validation for document binds. UID 1000; no chmod 777.
# shellcheck shell=bash

storage_is_forbidden_path() {
  local raw="${1:-}"
  local path
  [[ -n "${raw}" ]] || return 0
  path="$(storage_normalize_path "${raw}")" || return 0
  case "${path}" in
    /|/bin|/boot|/dev|/etc|/lib|/lib64|/proc|/root|/sbin|/sys|/usr)
      return 0
      ;;
    /bin/*|/boot/*|/dev/*|/etc/*|/lib/*|/lib64/*|/proc/*|/root/*|/sbin/*|/sys/*|/usr/*)
      return 0
      ;;
  esac
  return 1
}

storage_normalize_path() {
  local raw="${1:-}"
  python3 - "${raw}" <<'PY'
import os, sys
raw = sys.argv[1]
if not raw:
    sys.exit(1)
print(os.path.abspath(os.path.expanduser(raw)))
PY
}

storage_fstype() {
  local path="$1"
  df -T "${path}" 2>/dev/null | awk 'NR==2 {print $2; exit}'
}

storage_is_remote_fstype() {
  local t="${1:-}"
  case "${t}" in
    nfs|nfs4|nfs3|cifs|smb3|smb2|fuse.sshfs) return 0 ;;
  esac
  return 1
}

storage_uid_of() {
  local path="$1"
  stat -c '%u' "${path}" 2>/dev/null || stat -f '%u' "${path}"
}

storage_gid_of() {
  local path="$1"
  stat -c '%g' "${path}" 2>/dev/null || stat -f '%g' "${path}"
}

storage_writable_by_app_user() {
  local path="$1"
  local marker="${path}/.folium-write-test"
  if docker_info_ok; then
    docker_bin run --rm --user "${FOLIUM_APP_UID}:${FOLIUM_APP_GID}" \
      -v "${path}:/mnt" alpine:3.20 sh -c 'touch /mnt/.folium-write-test && rm -f /mnt/.folium-write-test' \
      >/dev/null 2>&1
    return $?
  fi
  if [[ "$(storage_uid_of "${path}")" == "${FOLIUM_APP_UID}" ]]; then
    touch "${marker}" 2>/dev/null && rm -f "${marker}"
    return $?
  fi
  return 1
}

storage_prepare_dir() {
  local path="$1"
  local do_chown="${2:-0}"
  if [[ ! -d "${path}" ]]; then
    run_root mkdir -p "${path}"
  fi
  if [[ "${do_chown}" == "1" ]]; then
    run_root chown "${FOLIUM_APP_UID}:${FOLIUM_APP_GID}" "${path}"
  fi
  storage_writable_by_app_user "${path}"
}
