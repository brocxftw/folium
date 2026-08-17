#!/usr/bin/env bash
# Unit-like tests for installer helpers (no TUI, no live stack).
# shellcheck disable=SC1091,SC2034,SC2016
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT}/.." && pwd)"
# shellcheck source=../lib/common.sh
source "${ROOT}/lib/common.sh"
# shellcheck source=../lib/logging.sh
source "${ROOT}/lib/logging.sh"
# shellcheck source=../lib/storage.sh
source "${ROOT}/lib/storage.sh"
# shellcheck source=../lib/network.sh
source "${ROOT}/lib/network.sh"
# shellcheck source=../lib/config.sh
source "${ROOT}/lib/config.sh"
# shellcheck source=../lib/state.sh
source "${ROOT}/lib/state.sh"
# shellcheck source=../lib/docker.sh
source "${ROOT}/lib/docker.sh"

FOLIUM_LOG_FILE="/dev/null"
FAILED=0
PASSED=0

assert_eq() {
  local name="$1" got="$2" want="$3"
  if [[ "${got}" == "${want}" ]]; then
    PASSED=$((PASSED + 1))
    printf 'ok  %s\n' "${name}"
  else
    FAILED=$((FAILED + 1))
    printf 'FAIL %s\n  got:  %s\n  want: %s\n' "${name}" "${got}" "${want}"
  fi
}

assert_ok() {
  local name="$1"
  shift
  if "$@"; then
    PASSED=$((PASSED + 1))
    printf 'ok  %s\n' "${name}"
  else
    FAILED=$((FAILED + 1))
    printf 'FAIL %s (expected success)\n' "${name}"
  fi
}

assert_fail() {
  local name="$1"
  shift
  if "$@"; then
    FAILED=$((FAILED + 1))
    printf 'FAIL %s (expected failure)\n' "${name}"
  else
    PASSED=$((PASSED + 1))
    printf 'ok  %s\n' "${name}"
  fi
}

assert_eq "strip v prefix" "$(config_strip_v_prefix "v0.1.16")" "0.1.16"
assert_eq "strip already plain" "$(config_strip_v_prefix "0.1.16")" "0.1.16"
assert_ok "pinned semver" config_is_pinned_version "0.1.16"
assert_ok "pinned with v" config_is_pinned_version "v0.1.16"
assert_fail "reject latest" config_is_pinned_version "latest"
assert_fail "reject empty" config_is_pinned_version ""

assert_ok "forbid /" storage_is_forbidden_path "/"
assert_ok "forbid /etc" storage_is_forbidden_path "/etc"
assert_ok "forbid /usr/bin" storage_is_forbidden_path "/usr/bin"
assert_ok "forbid /boot" storage_is_forbidden_path "/boot"
assert_fail "allow /opt/folium" storage_is_forbidden_path "/opt/folium"
assert_fail "allow /mnt/data/docs" storage_is_forbidden_path "/mnt/data/docs"

assert_ok "bind lan" network_bind_valid "0.0.0.0"
assert_ok "bind loopback" network_bind_valid "127.0.0.1"
assert_fail "bind other" network_bind_valid "10.0.0.1"
assert_ok "port 8080" network_port_valid "8080"
assert_fail "port 0" network_port_valid "0"
assert_fail "port junk" network_port_valid "abc"

assert_eq "origin loopback" "$(network_origin_for 127.0.0.1 8080 "")" "http://127.0.0.1:8080"
assert_eq "origin public" "$(network_origin_for 0.0.0.0 8080 "https://docs.example.com/")" "https://docs.example.com"

redacted="$(printf 'FOLIUM_SECRET_KEY=abc\nPOSTGRES_PASSWORD=s3cret\nFRONTEND_ORIGIN=http://x\n' | _folium_redact)"
assert_eq "redact secret key" "$(printf '%s\n' "${redacted}" | sed -n '1p')" "FOLIUM_SECRET_KEY=***REDACTED***"
assert_eq "redact password" "$(printf '%s\n' "${redacted}" | sed -n '2p')" "POSTGRES_PASSWORD=***REDACTED***"
assert_eq "keep origin" "$(printf '%s\n' "${redacted}" | sed -n '3p')" "FRONTEND_ORIGIN=http://x"

assert_fail "postgres @ rejected" config_postgres_password_ok "foo@bar"
assert_ok "postgres hex ok" config_postgres_password_ok "deadbeef"

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

cp "${REPO_ROOT}/docker-compose.yml" "${TMP}/docker-compose.yml"
config_strip_compose_ports "${TMP}/docker-compose.yml"
if grep -q '8000:8000' "${TMP}/docker-compose.yml"; then
  FAILED=$((FAILED + 1))
  printf 'FAIL compose strip left api 8000\n'
else
  PASSED=$((PASSED + 1))
  printf 'ok  compose strip api port\n'
fi
if grep -q '8080:80' "${TMP}/docker-compose.yml"; then
  FAILED=$((FAILED + 1))
  printf 'FAIL compose strip left web 8080\n'
else
  PASSED=$((PASSED + 1))
  printf 'ok  compose strip web port\n'
fi

FOLIUM_INSTALL_DIR="${TMP}"
FOLIUM_BIND="127.0.0.1"
FOLIUM_HTTP_PORT="18080"
FOLIUM_EXPOSE_API="0"
FOLIUM_EXTRA_GID="10000"
config_write_override
assert_ok "override has ui port" grep -q '\${FOLIUM_BIND}:\${FOLIUM_HTTP_PORT}:80' "${TMP}/docker-compose.override.yml"
assert_ok "override has extra gid" grep -q '10000' "${TMP}/docker-compose.override.yml"
assert_fail "override omits api publish" grep -q '8000:8000' "${TMP}/docker-compose.override.yml"

FOLIUM_EXPOSE_API="1"
FOLIUM_API_PORT="8000"
config_write_override
assert_ok "override can publish api" grep -q '\${FOLIUM_BIND}:\${FOLIUM_API_PORT}:8000' "${TMP}/docker-compose.override.yml"

assert_ok "blocked invalid port" network_port_blocked "0"

FOLIUM_VERSION="0.1.16"
FOLIUM_SECRET_KEY="unit-test-secret"
FOLIUM_ENCRYPTION_KEY="unit-test-encryption"
POSTGRES_PASSWORD="unit-test-postgres"
FOLIUM_ADMIN_PASSWORD="unit-test-admin"
FOLIUM_FRONTEND_ORIGIN="http://127.0.0.1:18080"
FOLIUM_DOCS_PATH="${TMP}/data/documents"
FOLIUM_CONSUME_PATH="${TMP}/data/consume"
FOLIUM_EXPORT_PATH="${TMP}/data/export"
FOLIUM_PADDLE_PATH="${TMP}/data/paddleocr"
FOLIUM_COMPOSE_PROJECT="folium-unit"
mkdir -p "${FOLIUM_DOCS_PATH}" "${FOLIUM_CONSUME_PATH}" "${FOLIUM_EXPORT_PATH}" "${FOLIUM_PADDLE_PATH}"
config_write_env
mode="$(stat -c '%a' "${TMP}/.env")"
assert_eq "env mode 600" "${mode}" "600"
assert_ok "env pins version" grep -q '^FOLIUM_VERSION=0.1.16$' "${TMP}/.env"
assert_fail "env not latest" grep -q '^FOLIUM_VERSION=latest$' "${TMP}/.env"

export FOLIUM_METHOD=image FOLIUM_VERSION_TAG=v0.1.16
state_write
assert_ok "state exists" test -f "${TMP}/install-state.json"
assert_fail "state has no secret key" grep -qi 'unit-test-secret' "${TMP}/install-state.json"
assert_fail "state has no admin password" grep -qi 'unit-test-admin' "${TMP}/install-state.json"
assert_eq "state version" "$(python3 -c 'import json; print(json.load(open("'"${TMP}"'/install-state.json"))["version"])')" "0.1.16"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  FOLIUM_EXPOSE_API="0"
  FOLIUM_EXTRA_GID=""
  config_write_override
  if (cd "${TMP}" && docker compose -p folium-unit -f docker-compose.yml -f docker-compose.override.yml config >/dev/null); then
    PASSED=$((PASSED + 1))
    printf 'ok  docker compose config\n'
  else
    FAILED=$((FAILED + 1))
    printf 'FAIL docker compose config\n'
  fi
else
  printf 'skip docker compose config (docker not available)\n'
fi

PACK="$(mktemp)"
if bash "${ROOT}/pack.sh" "${PACK}" && bash -n "${PACK}"; then
  PASSED=$((PASSED + 1))
  printf 'ok  pack.sh bash -n\n'
else
  FAILED=$((FAILED + 1))
  printf 'FAIL pack.sh\n'
fi
if grep -q '^FOLIUM_PACKED=1$' "${PACK}" \
  && grep -q 'folium_install_packed_ctl' "${PACK}" \
  && grep -q 'Folium interactive installer' "${PACK}"; then
  PASSED=$((PASSED + 1))
  printf 'ok  packed installer is standalone\n'
else
  FAILED=$((FAILED + 1))
  printf 'FAIL packed installer missing expected markers\n'
fi
rm -f "${PACK}"

printf '\n%d passed, %d failed\n' "${PASSED}" "${FAILED}"
[[ "${FAILED}" -eq 0 ]]
