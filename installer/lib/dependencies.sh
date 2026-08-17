# Optional package installs (whiptail, Docker, git). Never silent.
# shellcheck shell=bash

dep_install_whiptail() {
  local family
  family="$(system_pkg_family)"
  log_info "installing whiptail (family=${family})"
  case "${family}" in
    debian)
      run_root apt-get update -y
      run_root apt-get install -y whiptail
      ;;
    rhel)
      if require_cmd dnf; then
        run_root dnf install -y newt
      else
        run_root yum install -y newt
      fi
      ;;
    *)
      log_error "cannot install whiptail on unknown OS family"
      return 1
      ;;
  esac
  command -v whiptail >/dev/null 2>&1
}

dep_install_git() {
  if require_cmd git; then
    return 0
  fi
  local family
  family="$(system_pkg_family)"
  log_info "installing git"
  case "${family}" in
    debian) run_root apt-get update -y && run_root apt-get install -y git ;;
    rhel)
      if require_cmd dnf; then
        run_root dnf install -y git
      else
        run_root yum install -y git
      fi
      ;;
    *) return 1 ;;
  esac
}

dep_install_docker_engine() {
  log_info "installing Docker Engine via get.docker.com"
  curl -fsSL https://get.docker.com -o /tmp/folium-get-docker.sh
  chmod 700 /tmp/folium-get-docker.sh
  run_root sh /tmp/folium-get-docker.sh
  rm -f /tmp/folium-get-docker.sh
  if require_cmd systemctl; then
    run_root systemctl enable --now docker >/dev/null 2>&1 || true
  fi
  docker_configure_cmd
  docker_info_ok
}
