# Whiptail UI helpers. Core install logic must not live only in these wrappers.
# shellcheck shell=bash

FOLIUM_UI="${FOLIUM_UI:-whiptail}"
FOLIUM_UI_TITLE="${FOLIUM_UI_TITLE:-Folium Installer}"
FOLIUM_UI_HEIGHT="${FOLIUM_UI_HEIGHT:-20}"
FOLIUM_UI_WIDTH="${FOLIUM_UI_WIDTH:-72}"

ui_available() {
  command -v whiptail >/dev/null 2>&1
}

ui_require() {
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    return 0
  fi
  if ! ui_available; then
    echo "whiptail is required for the Folium installer TUI." >&2
    return 1
  fi
}

_ui_whiptail() {
  whiptail --backtitle "Folium" --title "${FOLIUM_UI_TITLE}" "$@"
}

ui_msgbox() {
  local text="$1"
  log_info "ui_msgbox"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s\n' "${text}"
    return 0
  fi
  _ui_whiptail --msgbox "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}"
}

ui_yesno() {
  local text="$1"
  log_info "ui_yesno"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    [[ "${FOLIUM_UI_YESNO:-yes}" == "yes" ]]
    return $?
  fi
  _ui_whiptail --yesno "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}"
}

ui_input() {
  local text="$1"
  local default="${2:-}"
  local result=""
  log_info "ui_input"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s' "${FOLIUM_UI_INPUT:-${default}}"
    return 0
  fi
  result="$(_ui_whiptail --inputbox "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}" "${default}" 3>&1 1>&2 2>&3)" || return 1
  printf '%s' "${result}"
}

ui_password() {
  local text="$1"
  local result=""
  log_info "ui_password"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s' "${FOLIUM_UI_PASSWORD:-}"
    return 0
  fi
  result="$(_ui_whiptail --passwordbox "${text}" 10 "${FOLIUM_UI_WIDTH}" 3>&1 1>&2 2>&3)" || return 1
  printf '%s' "${result}"
}

ui_menu() {
  # Usage: ui_menu "text" tag1 item1 tag2 item2 ...
  local text="$1"
  shift
  log_info "ui_menu"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s' "${FOLIUM_UI_MENU:-$1}"
    return 0
  fi
  _ui_whiptail --menu "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}" 8 "$@" 3>&1 1>&2 2>&3
}

ui_radiolist() {
  local text="$1"
  shift
  log_info "ui_radiolist"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s' "${FOLIUM_UI_MENU:-$1}"
    return 0
  fi
  _ui_whiptail --radiolist "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}" 8 "$@" 3>&1 1>&2 2>&3
}

ui_textbox_file() {
  local file="$1"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    cat "${file}"
    return 0
  fi
  _ui_whiptail --scrolltext --textbox "${file}" 24 78
}

ui_infobox() {
  local text="$1"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s\n' "${text}"
    return 0
  fi
  _ui_whiptail --infobox "${text}" 8 "${FOLIUM_UI_WIDTH}"
}

ui_gauge_pair() {
  # Reads "percent\nmessage" lines from stdin for a gauge.
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    cat >/dev/null
    return 0
  fi
  _ui_whiptail --gauge "Working..." 8 "${FOLIUM_UI_WIDTH}" 0
}
