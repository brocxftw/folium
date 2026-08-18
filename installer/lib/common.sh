# Shared constants and small helpers.
# shellcheck shell=bash

FOLIUM_GITHUB_REPO="${FOLIUM_GITHUB_REPO:-brocxftw/folium}"
FOLIUM_GITHUB_URL="${FOLIUM_GITHUB_URL:-https://github.com/${FOLIUM_GITHUB_REPO}}"
FOLIUM_APP_UID="${FOLIUM_APP_UID:-1000}"
FOLIUM_APP_GID="${FOLIUM_APP_GID:-1000}"
FOLIUM_DEFAULT_INSTALL_DIR="${FOLIUM_DEFAULT_INSTALL_DIR:-/opt/folium}"
FOLIUM_DEFAULT_HTTP_PORT="${FOLIUM_DEFAULT_HTTP_PORT:-9398}"
FOLIUM_DEFAULT_API_PORT="${FOLIUM_DEFAULT_API_PORT:-9099}"
FOLIUM_DEFAULT_PROJECT="${FOLIUM_DEFAULT_PROJECT:-folium}"

is_root() {
  [[ "$(id -u)" -eq 0 ]]
}

run_root() {
  if is_root; then
    "$@"
  else
    sudo "$@"
  fi
}

require_cmd() {
  local name="$1"
  command -v "${name}" >/dev/null 2>&1
}

is_amd64() {
  local m
  m="$(uname -m)"
  [[ "${m}" == "x86_64" || "${m}" == "amd64" ]]
}

config_strip_v_prefix() {
  local v="${1:-}"
  v="${v#v}"
  printf '%s' "${v}"
}

config_is_pinned_version() {
  local v="${1:-}"
  v="$(config_strip_v_prefix "${v}")"
  [[ "${v}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+.-][A-Za-z0-9.-]+)?$ ]]
}

json_get() {
  python3 -c 'import json,sys; data=json.load(sys.stdin); path=sys.argv[1].split(".");
cur=data
for p in path:
    cur=cur[p]
if isinstance(cur,(dict,list)):
    json.dump(cur,sys.stdout)
else:
    print(cur, end="")
' "$1"
}
