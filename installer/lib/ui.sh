# Whiptail UI helpers. Core install logic must not live only in these wrappers.
# shellcheck shell=bash

FOLIUM_UI="${FOLIUM_UI:-whiptail}"
FOLIUM_UI_TITLE="${FOLIUM_UI_TITLE:-Folium Installer}"
FOLIUM_UI_HEIGHT="${FOLIUM_UI_HEIGHT:-20}"
FOLIUM_UI_WIDTH="${FOLIUM_UI_WIDTH:-72}"
FOLIUM_UI_ACTIVE=0
FOLIUM_UI_NOCANCEL=0
FOLIUM_UI_OK_LABEL="OK"
FOLIUM_UI_CANCEL_LABEL="Back"
FOLIUM_GAUGE_FD=""
FOLIUM_GAUGE_PID=""
FOLIUM_INTERRUPTED=0

# Wizard: 0 = next/ok, 2 = previous screen, 3 = cancel installer. Ctrl+C exits too.
UI_OK=0
UI_BACK=2
UI_CANCEL=3

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

ui_is_tui() {
  [[ "${FOLIUM_UI}" != "none" ]] && [[ -t 0 ]] && [[ -e /dev/tty ]]
}

ui_paint_bg() {
  ui_is_tui || return 0
  # Newt restores the screen it saved at init. Keep that buffer blue so
  # dismissing a dialog does not flash the shell prompt.
  {
    printf '\033[0;37;44m'
    if command -v tput >/dev/null 2>&1; then
      tput civis 2>/dev/null || true
      tput clear 2>/dev/null || printf '\033[2J\033[H'
    else
      printf '\033[?25l\033[2J\033[H'
    fi
  } >/dev/tty 2>/dev/null || true
}

ui_session_start() {
  ui_is_tui || return 0
  FOLIUM_UI_ACTIVE=1
  FOLIUM_INTERRUPTED=0
  # Root screen stays blue; the dialog card itself is grey.
  export NEWT_COLORS="${NEWT_COLORS:-
root=white,blue
roottext=white,blue
border=black,lightgray
window=black,lightgray
shadow=black,gray
title=black,lightgray
textbox=black,lightgray
entry=black,lightgray
listbox=black,lightgray
actsellistbox=white,blue
actlistbox=black,cyan
label=black,lightgray
button=black,cyan
actbutton=white,blue
compactbutton=black,lightgray
helpline=white,blue
emptyscale=,gray
fullscale=,cyan
}"
  ui_paint_bg
}

ui_kill_whiptail_children() {
  local pid
  if [[ -n "${FOLIUM_GAUGE_PID:-}" ]]; then
    kill -TERM "${FOLIUM_GAUGE_PID}" 2>/dev/null || true
    kill -KILL "${FOLIUM_GAUGE_PID}" 2>/dev/null || true
  fi
  for pid in $(pgrep -P "$$" -x whiptail 2>/dev/null || true); do
    kill -TERM "${pid}" 2>/dev/null || true
    kill -KILL "${pid}" 2>/dev/null || true
  done
}

ui_check_interrupted() {
  if [[ "${FOLIUM_INTERRUPTED}" == "1" ]]; then
    return 130
  fi
  return 0
}

ui_session_end() {
  [[ "${FOLIUM_UI_ACTIVE}" == "1" || -n "${FOLIUM_GAUGE_PID:-}" || -n "${FOLIUM_GAUGE_FD:-}" ]] || return 0
  ui_kill_whiptail_children
  if [[ -n "${FOLIUM_GAUGE_FD}" ]]; then
    exec {FOLIUM_GAUGE_FD}>&- 2>/dev/null || true
    FOLIUM_GAUGE_FD=""
  fi
  if [[ -n "${FOLIUM_GAUGE_PID}" ]]; then
    local _
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "${FOLIUM_GAUGE_PID}" 2>/dev/null || break
      sleep 0.05
    done
    kill -KILL "${FOLIUM_GAUGE_PID}" 2>/dev/null || true
    wait "${FOLIUM_GAUGE_PID}" 2>/dev/null || true
    FOLIUM_GAUGE_PID=""
  fi
  FOLIUM_UI_ACTIVE=0
  ui_is_tui || return 0
  {
    if command -v tput >/dev/null 2>&1; then
      tput cnorm 2>/dev/null || true
      tput sgr0 2>/dev/null || true
      tput clear 2>/dev/null || printf '\033[0m\033[2J\033[H'
    else
      printf '\033[0m\033[?25h\033[2J\033[H'
    fi
  } >/dev/tty 2>/dev/null || true
  stty sane </dev/tty 2>/dev/null || stty sane 2>/dev/null || true
}

_ui_whiptail() {
  local -a extra=()
  local rc=0 wp=""
  ui_check_interrupted || return 130
  ui_paint_bg
  if [[ "${FOLIUM_UI_NOCANCEL}" == "1" ]]; then
    extra+=(--nocancel --ok-button "${FOLIUM_UI_OK_LABEL}")
  else
    extra+=(--ok-button "${FOLIUM_UI_OK_LABEL}" --cancel-button "${FOLIUM_UI_CANCEL_LABEL}")
  fi
  set +e
  # Run whiptail in the background so Ctrl+C reaches this shell (trap/on_interrupt).
  whiptail --backtitle "Folium" --title "${FOLIUM_UI_TITLE}" "${extra[@]}" "$@" &
  wp=$!
  wait "${wp}"
  rc=$?
  set -e
  ui_paint_bg
  if [[ "${FOLIUM_INTERRUPTED}" == "1" ]]; then
    return 130
  fi
  return "${rc}"
}

# Map newt/whiptail status to UI_OK / UI_BACK. Unexpected codes re-show (except SIGINT).
_ui_run() {
  local allow_back="${1:-1}"
  shift
  local rc=0
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    return 0
  fi
  while true; do
    ui_check_interrupted || return 130
    set +e
    "$@"
    rc=$?
    set -e
    if [[ "${FOLIUM_INTERRUPTED}" == "1" || "${rc}" -eq 130 ]]; then
      return 130
    fi
    case "${rc}" in
      0) return "${UI_OK}" ;;
      1)
        if [[ "${allow_back}" == "1" ]]; then
          return "${UI_BACK}"
        fi
        # --nocancel: ESC re-shows; Ctrl+C is handled via FOLIUM_INTERRUPTED.
        ;;
      255)
        if [[ "${allow_back}" == "1" ]]; then
          return "${UI_BACK}"
        fi
        ;;
      *)
        # Unknown status: do not spin forever.
        return 130
        ;;
    esac
  done
}

ui_msgbox() {
  local text="$1"
  log_info "ui_msgbox"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s\n' "${text}"
    return 0
  fi
  local saved="${FOLIUM_UI_NOCANCEL}"
  FOLIUM_UI_NOCANCEL=1
  FOLIUM_UI_OK_LABEL="OK"
  _ui_run 0 _ui_whiptail --msgbox "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}"
  local rc=$?
  FOLIUM_UI_NOCANCEL="${saved}"
  [[ "${rc}" -eq 130 ]] && return 130
  return 0
}

ui_yesno() {
  local text="$1"
  log_info "ui_yesno"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    [[ "${FOLIUM_UI_YESNO:-yes}" == "yes" ]]
    return $?
  fi
  local saved="${FOLIUM_UI_NOCANCEL}"
  FOLIUM_UI_NOCANCEL=1
  FOLIUM_UI_OK_LABEL="Yes"
  set +e
  _ui_whiptail --yes-button "Yes" --no-button "No" --yesno "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}"
  local rc=$?
  set -e
  FOLIUM_UI_NOCANCEL="${saved}"
  FOLIUM_UI_OK_LABEL="OK"
  ui_paint_bg
  if [[ "${FOLIUM_INTERRUPTED}" == "1" || "${rc}" -eq 130 ]]; then
    return 130
  fi
  [[ "${rc}" -eq 0 ]]
}

# Menu: prints tag. Return UI_OK or UI_BACK.
ui_menu() {
  local text="$1"
  shift
  log_info "ui_menu"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    if [[ "${FOLIUM_UI_CANCEL:-0}" == "1" ]]; then
      return "${UI_BACK}"
    fi
    printf '%s' "${FOLIUM_UI_MENU:-$1}"
    return "${UI_OK}"
  fi
  local result="" rc=0 allow_back=1
  if [[ "${FOLIUM_UI_NOCANCEL}" == "1" ]]; then
    allow_back=0
  fi
  while true; do
    ui_check_interrupted || return 130
    set +e
    result="$(_ui_whiptail --menu "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}" 8 "$@" 3>&1 1>&2 2>&3)"
    rc=$?
    set -e
    ui_paint_bg
    if [[ "${FOLIUM_INTERRUPTED}" == "1" || "${rc}" -eq 130 ]]; then
      return 130
    fi
    case "${rc}" in
      0)
        printf '%s' "${result}"
        return "${UI_OK}"
        ;;
      1|255)
        if [[ "${allow_back}" == "1" ]]; then
          return "${UI_BACK}"
        fi
        ;;
      *)
        return 130
        ;;
    esac
  done
}

ui_input() {
  local text="$1"
  local default="${2:-}"
  local result="" rc=0
  log_info "ui_input"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    if [[ "${FOLIUM_UI_CANCEL:-0}" == "1" ]]; then
      return "${UI_BACK}"
    fi
    printf '%s' "${FOLIUM_UI_INPUT:-${default}}"
    return "${UI_OK}"
  fi
  local allow_back=1
  if [[ "${FOLIUM_UI_NOCANCEL}" == "1" ]]; then
    allow_back=0
  fi
  while true; do
    ui_check_interrupted || return 130
    set +e
    result="$(_ui_whiptail --inputbox "${text}" "${FOLIUM_UI_HEIGHT}" "${FOLIUM_UI_WIDTH}" "${default}" 3>&1 1>&2 2>&3)"
    rc=$?
    set -e
    ui_paint_bg
    if [[ "${FOLIUM_INTERRUPTED}" == "1" || "${rc}" -eq 130 ]]; then
      return 130
    fi
    case "${rc}" in
      0)
        printf '%s' "${result}"
        return "${UI_OK}"
        ;;
      1|255)
        if [[ "${allow_back}" == "1" ]]; then
          return "${UI_BACK}"
        fi
        ;;
      *)
        return 130
        ;;
    esac
  done
}

ui_password() {
  local text="$1"
  local result="" rc=0
  log_info "ui_password"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s' "${FOLIUM_UI_PASSWORD:-}"
    return "${UI_OK}"
  fi
  while true; do
    ui_check_interrupted || return 130
    set +e
    result="$(_ui_whiptail --passwordbox "${text}" 10 "${FOLIUM_UI_WIDTH}" 3>&1 1>&2 2>&3)"
    rc=$?
    set -e
    ui_paint_bg
    if [[ "${FOLIUM_INTERRUPTED}" == "1" || "${rc}" -eq 130 ]]; then
      return 130
    fi
    case "${rc}" in
      0)
        printf '%s' "${result}"
        return "${UI_OK}"
        ;;
      1|255) return "${UI_BACK}" ;;
      *) return 130 ;;
    esac
  done
}

ui_radiolist() {
  local text="$1"
  shift
  log_info "ui_radiolist"
  ui_menu "${text}" "$@"
}

ui_textbox_file() {
  local file="$1"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    cat "${file}"
    return "${UI_OK}"
  fi
  local rc=0
  set +e
  _ui_whiptail --scrolltext --textbox "${file}" 24 78
  rc=$?
  set -e
  ui_paint_bg
  if [[ "${FOLIUM_INTERRUPTED}" == "1" || "${rc}" -eq 130 ]]; then
    return 130
  fi
  case "${rc}" in
    0) return "${UI_OK}" ;;
    1|255) return "${UI_BACK}" ;;
    *) return 130 ;;
  esac
}

# Final confirmation: summary plus Install, Back, and Cancel installer.
ui_confirm_summary_file() {
  local file="$1"
  local text="" go=""
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    cat "${file}"
    return "${UI_OK}"
  fi
  text="$(cat "${file}")"
  go="$(ui_menu "${text}

Choose an action:" \
    install "Install" \
    back "Back" \
    cancel "Cancel installer")" || return "${UI_BACK}"
  case "${go}" in
    install) return "${UI_OK}" ;;
    cancel) return "${UI_CANCEL}" ;;
    *) return "${UI_BACK}" ;;
  esac
}

ui_infobox() {
  local text="$1"
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    printf '%s\n' "${text}"
    return 0
  fi
  local saved="${FOLIUM_UI_NOCANCEL}"
  FOLIUM_UI_NOCANCEL=1
  set +e
  _ui_whiptail --infobox "${text}" 8 "${FOLIUM_UI_WIDTH}"
  set -e
  FOLIUM_UI_NOCANCEL="${saved}"
}

ui_gauge_start() {
  local text="${1:-Installing Folium...}"
  ui_gauge_stop || true
  if [[ "${FOLIUM_UI}" == "none" ]] || ! ui_is_tui; then
    printf '%s\n' "${text}"
    return 0
  fi
  local fifo
  fifo="$(mktemp -u /tmp/folium-gauge-XXXXXX)"
  mkfifo "${fifo}"
  ui_paint_bg
  # Do not use _ui_whiptail here: button flags break --gauge.
  whiptail --backtitle "Folium" --title "${FOLIUM_UI_TITLE}" \
    --gauge "${text}" 8 "${FOLIUM_UI_WIDTH}" 0 <"${fifo}" &
  FOLIUM_GAUGE_PID=$!
  exec {FOLIUM_GAUGE_FD}>"${fifo}"
  rm -f "${fifo}"
  ui_gauge_update 0 "${text}"
}

ui_gauge_update() {
  local pct="$1"
  local msg="${2:-}"
  if [[ -z "${FOLIUM_GAUGE_FD}" ]]; then
    [[ "${FOLIUM_UI}" == "none" ]] && printf '%s%% %s\n' "${pct}" "${msg}"
    return 0
  fi
  printf '%s\nXXX\n%s\nXXX\n' "${pct}" "${msg}" >&"${FOLIUM_GAUGE_FD}" || true
}

ui_gauge_stop() {
  if [[ -n "${FOLIUM_GAUGE_FD}" ]]; then
    exec {FOLIUM_GAUGE_FD}>&- 2>/dev/null || true
    FOLIUM_GAUGE_FD=""
  fi
  if [[ -n "${FOLIUM_GAUGE_PID}" ]]; then
    local _
    # Prefer a clean exit; never block forever on Ctrl+C paths.
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "${FOLIUM_GAUGE_PID}" 2>/dev/null || break
      sleep 0.05
    done
    if kill -0 "${FOLIUM_GAUGE_PID}" 2>/dev/null; then
      kill -TERM "${FOLIUM_GAUGE_PID}" 2>/dev/null || true
      sleep 0.05
      kill -KILL "${FOLIUM_GAUGE_PID}" 2>/dev/null || true
    fi
    wait "${FOLIUM_GAUGE_PID}" 2>/dev/null || true
    FOLIUM_GAUGE_PID=""
  fi
  ui_paint_bg
}

ui_gauge_pair() {
  if [[ "${FOLIUM_UI}" == "none" ]]; then
    cat >/dev/null
    return 0
  fi
  FOLIUM_UI_NOCANCEL=1
  _ui_whiptail --gauge "Working..." 8 "${FOLIUM_UI_WIDTH}" 0
  FOLIUM_UI_NOCANCEL=0
}
