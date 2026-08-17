#!/usr/bin/env bash
# Bootstrap: download the installer tarball from a GitHub Release and run it.
# Prefer: curl -fsSL -o install-folium.sh URL && less install-folium.sh && bash install-folium.sh
set -euo pipefail

FOLIUM_GITHUB_REPO="${FOLIUM_GITHUB_REPO:-brocxftw/folium}"
TAG="${FOLIUM_BOOTSTRAP_VERSION:-}"

usage() {
  cat <<'EOF'
Usage: install-folium.sh [--version vX.Y.Z]

Downloads folium-installer.tar.gz from a GitHub Release, extracts it, and
runs the interactive installer.

If this script sits next to install.sh (git clone or extracted tarball),
it runs that local installer instead of downloading.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)
      TAG="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/install.sh" && -d "${SCRIPT_DIR}/lib" ]]; then
  exec bash "${SCRIPT_DIR}/install.sh" "$@"
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to resolve the latest release tag." >&2
  exit 1
fi

if [[ -z "${TAG}" ]]; then
  TAG="$(curl -fsSL --max-time 20 -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${FOLIUM_GITHUB_REPO}/releases/latest" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["tag_name"])')"
fi

WORKDIR="$(mktemp -d /tmp/folium-bootstrap-XXXXXX)"
# Invoked by the EXIT trap until exec replaces this process.
# shellcheck disable=SC2317
cleanup() { rm -rf "${WORKDIR}"; }
trap cleanup EXIT

cd "${WORKDIR}"
ASSET_BASE="https://github.com/${FOLIUM_GITHUB_REPO}/releases/download/${TAG}"
echo "Downloading Folium installer ${TAG}..."
curl -fsSL --max-time 120 -o folium-installer.tar.gz "${ASSET_BASE}/folium-installer.tar.gz"

if curl -fsSL --max-time 30 -o checksums.txt "${ASSET_BASE}/checksums.txt"; then
  if command -v sha256sum >/dev/null 2>&1; then
    grep 'folium-installer.tar.gz$' checksums.txt | sha256sum -c -
  fi
else
  echo "Warning: checksums.txt was not available for ${TAG}; continuing without verification." >&2
fi

tar -xzf folium-installer.tar.gz
if [[ -f installer/install.sh ]]; then
  trap - EXIT
  exec bash installer/install.sh "$@"
fi
if [[ -f install.sh ]]; then
  trap - EXIT
  exec bash install.sh "$@"
fi
echo "Installer tarball did not contain install.sh" >&2
exit 1
