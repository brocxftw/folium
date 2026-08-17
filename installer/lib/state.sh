# Installer metadata (no secrets).
# shellcheck shell=bash

state_file_path() {
  printf '%s/install-state.json' "${FOLIUM_INSTALL_DIR:-/opt/folium}"
}

state_exists() {
  [[ -f "$(state_file_path)" ]]
}

state_read_field() {
  local field="$1"
  local file
  file="$(state_file_path)"
  [[ -f "${file}" ]] || return 1
  python3 - "${file}" "${field}" <<'PY'
import json, sys
path, field = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as fh:
    data = json.load(fh)
cur = data
for part in field.split("."):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        sys.exit(1)
if isinstance(cur, (dict, list)):
    json.dump(cur, sys.stdout)
elif isinstance(cur, bool):
    print("true" if cur else "false", end="")
elif cur is None:
    print("", end="")
else:
    print(cur, end="")
PY
}

state_write() {
  local dest
  dest="$(state_file_path)"
  umask 022
  mkdir -p "${FOLIUM_INSTALL_DIR}"
  export FOLIUM_METHOD FOLIUM_VERSION FOLIUM_VERSION_TAG FOLIUM_INSTALL_DIR
  export FOLIUM_BIND FOLIUM_HTTP_PORT FOLIUM_API_PORT FOLIUM_EXPOSE_API FOLIUM_FRONTEND_ORIGIN
  export FOLIUM_DOCS_PATH FOLIUM_CONSUME_PATH FOLIUM_EXPORT_PATH FOLIUM_PADDLE_PATH
  export FOLIUM_EXTRA_GID FOLIUM_COMPOSE_PROJECT
  python3 - "${dest}" <<PY
import json, os, sys
dest = sys.argv[1]
data = {
  "schema": 1,
  "install_method": os.environ.get("FOLIUM_METHOD", "image"),
  "version": os.environ.get("FOLIUM_VERSION", ""),
  "version_tag": os.environ.get("FOLIUM_VERSION_TAG", ""),
  "install_dir": os.environ.get("FOLIUM_INSTALL_DIR", ""),
  "network": {
    "bind": os.environ.get("FOLIUM_BIND", "0.0.0.0"),
    "port": int(os.environ.get("FOLIUM_HTTP_PORT", "8080")),
    "api_port": int(os.environ.get("FOLIUM_API_PORT", "8000")),
    "expose_api": os.environ.get("FOLIUM_EXPOSE_API", "0") == "1",
    "frontend_origin": os.environ.get("FOLIUM_FRONTEND_ORIGIN", ""),
  },
  "storage": {
    "documents": os.environ.get("FOLIUM_DOCS_PATH", ""),
    "consume": os.environ.get("FOLIUM_CONSUME_PATH", ""),
    "export": os.environ.get("FOLIUM_EXPORT_PATH", ""),
    "paddle_cache": os.environ.get("FOLIUM_PADDLE_PATH", ""),
  },
  "extra_gid": os.environ.get("FOLIUM_EXTRA_GID", ""),
  "compose_project": os.environ.get("FOLIUM_COMPOSE_PROJECT", "folium"),
}
with open(dest, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")
PY
  log_info "wrote install-state.json"
}

state_write_pointer() {
  if [[ "${FOLIUM_SKIP_CLI:-0}" == "1" ]]; then
    return 0
  fi
  run_root mkdir -p /etc/folium
  printf '%s\n' "${FOLIUM_INSTALL_DIR}" | run_root tee /etc/folium/install-dir >/dev/null
  run_root chmod 644 /etc/folium/install-dir
}

state_discover_dir() {
  if [[ -n "${FOLIUM_INSTALL_DIR:-}" && -f "${FOLIUM_INSTALL_DIR}/install-state.json" ]]; then
    printf '%s' "${FOLIUM_INSTALL_DIR}"
    return 0
  fi
  if [[ -f /etc/folium/install-dir ]]; then
    local p
    p="$(tr -d '\n' </etc/folium/install-dir)"
    if [[ -f "${p}/install-state.json" ]]; then
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
