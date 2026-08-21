# Helpers for `folium update` (download release installer + noninteractive --update).
# shellcheck shell=bash

ctl_update_default_version() {
  printf 'beta'
}

# Normalize an operator arg for --version and installer URL selection.
# Empty → default (beta). Aliases stay as latest|beta. Pins become v-prefixed.
ctl_update_normalize_target() {
  local raw="${1:-}"
  if [[ -z "${raw}" ]]; then
    ctl_update_default_version
    return 0
  fi
  local stripped
  stripped="$(config_strip_v_prefix "${raw}")"
  case "${stripped}" in
    latest|beta)
      printf '%s' "${stripped}"
      return 0
      ;;
  esac
  if config_is_pinned_version "${stripped}"; then
    printf 'v%s' "${stripped}"
    return 0
  fi
  return 1
}

# Newest GitHub prerelease tag (vX.Y.Z-beta.N). Override in unit tests.
ctl_update_latest_prerelease_tag() {
  local tag plain
  while IFS= read -r tag; do
    [[ -n "${tag}" ]] || continue
    plain="$(config_strip_v_prefix "${tag}")"
    if [[ "${plain}" == *-* ]]; then
      printf '%s\n' "${tag}"
      return 0
    fi
  done < <(
    curl -fsSL --max-time 20 \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${FOLIUM_GITHUB_REPO:-brocxftw/folium}/releases?per_page=30" \
      | python3 -c 'import json,sys
for rel in json.load(sys.stdin):
    if rel.get("draft"):
        continue
    print(rel["tag_name"])
'
  )
  return 1
}

# Download URL for install-folium.sh for a normalized target (latest|beta|v…).
ctl_update_installer_url() {
  local target="${1:-}"
  local repo="${FOLIUM_GITHUB_REPO:-brocxftw/folium}"
  case "${target}" in
    latest)
      printf 'https://github.com/%s/releases/latest/download/install-folium.sh' "${repo}"
      ;;
    beta)
      local tag
      tag="$(ctl_update_latest_prerelease_tag)" || return 1
      printf 'https://github.com/%s/releases/download/%s/install-folium.sh' "${repo}" "${tag}"
      ;;
    v*)
      printf 'https://github.com/%s/releases/download/%s/install-folium.sh' "${repo}" "${target}"
      ;;
    *)
      return 1
      ;;
  esac
}
