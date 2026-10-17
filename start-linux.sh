#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$(readlink -f "$0")")"

ensure_files(){
  if [[ ! -f .env ]]; then
    cp .env.example .env
    chmod 600 .env
    echo "[Notice] Created .env from .env.example. Edit it to set AI_API_KEY if needed."
  fi
  mkdir -p data/uploads
  [[ -f data/characters.json ]] || printf '[]\n' > data/characters.json
}

show_menu(){
  printf '\n====================================================================\n'
  printf '                     ✦ HushRP Launcher (Linux) ✦\n'
  printf '   Lightweight, Self-Hostable AI Roleplay Web App (Zero Dependencies)\n'
  printf '====================================================================\n'
  printf '  1) LOCAL MODE (PC Only)\n'
  printf '     -> http://127.0.0.1:%s (Single-player; loopback only)\n\n' "${PORT:-3000}"
  printf '  2) HOME WI-FI / LAN MODE (Mobile and Tablet on Same Network)\n'
  printf '     -> http://<Local-IP>:%s (LAN Guard blocks public internet)\n\n' "${PORT:-3000}"
  printf '  3) VPS / CLOUD MODE (Production Server Behind Reverse Proxy)\n'
  printf '     -> http://127.0.0.1:%s (Requires HTTPS reverse proxy like Nginx/Caddy)\n\n' "${PORT:-3000}"
  printf ' ------------------------------------------------------------------\n'
  printf '  4) Edit Settings (.env / API keys)\n'
  printf '  5) Run Tests (Execute test suite / npm test)\n'
  printf '  6) Exit\n'
  printf '====================================================================\n'
  read -r -p 'Select a mode [1-6]: ' choice
  case "$choice" in
    1) run_app '127.0.0.1' false "http://127.0.0.1:${PORT:-3000}" 'local' ;;
    2) run_lan ;;
    3) run_app '127.0.0.1' false "http://127.0.0.1:${PORT:-3000} (Reverse Proxy / HTTPS only)" 'vps' ;;
    4) edit_settings ;;
    5) ensure_files; npm test; show_menu ;;
    6) exit 0 ;;
    *) echo "Please choose a number from 1 to 6."; show_menu ;;
  esac
}

run_app(){
  local host="$1" lan="$2" url="$3" mode="${4:-local}"
  ensure_files
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
  export HOST="$host" LAN_ONLY="$lan" RUNTIME_MODE="$mode"
  if [[ "$lan" == true || "$mode" == "lan" ]]; then
    export ALLOW_CLIENT_API_KEYS="${ALLOW_CLIENT_API_KEYS:-true}"
  fi
  : "${PORT:=3000}"
  export PORT
  
  printf '\n====================================================================\n'
  if [[ "$mode" == "local" ]]; then
    printf '  [1] LOCAL MODE: Running on this computer only (127.0.0.1)\n'
    printf '====================================================================\n'
    printf '  * Access URL: %s\n' "$url"
    printf '  * Security: Bound to 127.0.0.1 only; other devices cannot connect.\n'
  elif [[ "$mode" == "lan" ]]; then
    printf '  [2] HOME WI-FI / LAN MODE: Accessible from devices on same Wi-Fi\n'
    printf '====================================================================\n'
    printf '  * Connect from phone or tablet on the same Wi-Fi network at:\n'
    printf '%s\n' "$url"
    printf '  * Security: LAN Guard active; public internet traffic is rejected.\n'
    printf '  * Port forwarding: Not required; use only trusted private networks.\n'
  elif [[ "$mode" == "vps" ]]; then
    printf '  [3] VPS / CLOUD MODE: Production Server (Reverse Proxy)\n'
    printf '====================================================================\n'
    printf '  * Internal loopback: %s\n' "$url"
    printf '  * Requirement: Must be placed behind an HTTPS reverse proxy (Nginx/Caddy).\n'
    printf '  * Security: Browser API keys are automatically disabled.\n'
  fi
  printf '  * To stop: Press Ctrl+C\n'
  printf '====================================================================\n\n'
  
  node server.js
  show_menu
}

run_lan(){
  local ips
  ips="$(node -e "console.log(require('./server').listPrivateIPv4().join(' '))")"
  local url_list=""
  if [[ -n "$ips" ]]; then
    for ip in $ips; do
      url_list+="       * http://$ip:${PORT:-3000}\n"
    done
  else
    url_list="       (No private IPv4 found; check your network connection)"
  fi
  run_app '0.0.0.0' true "$url_list" 'lan'
}

edit_settings(){
  ensure_files
  local editor="${EDITOR:-nano}"
  if command -v "$editor" >/dev/null 2>&1; then
    "$editor" .env
  else
    echo "EDITOR '$editor' is unavailable. Edit $PWD/.env with your preferred text editor."
    read -r -p 'Press Enter to return to menu...'
  fi
  show_menu
}

show_menu
