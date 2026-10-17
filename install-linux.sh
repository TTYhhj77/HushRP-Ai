#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$(readlink -f "$0")")"

say(){ printf '\n%s\n' "$*"; }
ensure_data(){ mkdir -p data/uploads; [[ -f data/characters.json ]] || printf '[]\n' > data/characters.json; }
ensure_env(){
  if [[ ! -f .env ]]; then cp .env.example .env; chmod 600 .env; say 'Created .env from .env.example'; fi
  ensure_data
}
ensure_node(){
  if ! command -v node >/dev/null 2>&1; then
    say 'Node.js is not installed. Install Node.js 20+ with your distro package manager or from nodejs.org, then rerun this script.'
    exit 1
  fi
  local major; major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if (( major < 20 )); then echo "Node.js 20+ is required; found $(node --version)." >&2; exit 1; fi
}

run_server(){
  local host="$1" lan="$2" port="$3" label="$4" mode="${5:-local}"
  ensure_node; ensure_env
  set -a; source ./.env; set +a
  export HOST="$host" LAN_ONLY="$lan" PORT="$port" RUNTIME_MODE="$mode"
  printf '\n====================================================================\n'
  echo "$label"
  if [[ "$lan" == true ]]; then
    echo 'LAN guard is enabled: requests from public IPs are rejected. Use trusted home Wi-Fi only.'
    echo 'No router port-forwarding is required or configured.'
  fi
  echo 'Press Ctrl+C to stop.'
  printf '====================================================================\n\n'
  node server.js
}

ask_port(){
  local current="${PORT:-3000}" answer
  read -r -p "Port [$current]: " answer
  PORT="${answer:-$current}"
  if ! [[ "$PORT" =~ ^[0-9]{1,5}$ ]] || ((PORT<1 || PORT>65535)); then echo 'Invalid TCP port.' >&2; return 1; fi
}

menu(){
  printf '\n====================================================================\n'
  printf '               ✦ HushRP Linux Installer / Launcher ✦\n'
  printf '   Lightweight, Self-Hostable AI Roleplay Web App (Zero Dependencies)\n'
  printf '====================================================================\n'
  printf '  1) Install/check files and edit settings (.env)\n'
  printf '  2) LOCAL MODE (PC Only / 127.0.0.1)\n'
  printf '  3) HOME WI-FI / LAN MODE (Mobile & Tablet on Same Network)\n'
  printf '  4) VPS / CLOUD MODE (Production Server Behind HTTPS Reverse Proxy)\n'
  printf '  5) Run tests (npm test)\n'
  printf '  6) Exit\n'
  printf '====================================================================\n'
  read -r -p 'Select a mode [1-6]: ' choice
  case "$choice" in
    1) ensure_node; ensure_env; "${EDITOR:-nano}" .env || true; menu ;;
    2) ask_port && run_server 127.0.0.1 false "$PORT" "[1] Local: http://127.0.0.1:$PORT (PC only)" "local"; menu ;;
    3) ask_port || { menu; return; }; local ips; ips="$(node -e "console.log(require('./server').listPrivateIPv4().join(' '))")"; for ip in $ips; do echo "Same-Wi-Fi address: http://$ip:$PORT"; done; run_server 0.0.0.0 true "$PORT" "[2] LAN on port $PORT (Mobile / Home Wi-Fi)" "lan"; menu ;;
    4) ask_port && run_server 127.0.0.1 false "$PORT" "[3] VPS loopback: http://127.0.0.1:$PORT — put Caddy/Nginx HTTPS in front" "vps"; menu ;;
    5) ensure_node; npm test; menu ;;
    6) exit 0 ;;
    *) echo 'Choose a number from 1 to 6.'; menu ;;
  esac
}
menu
