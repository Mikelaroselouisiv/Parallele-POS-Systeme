#!/usr/bin/env bash
# Installe Nginx sur l’EC2 (Amazon Linux 2 / 2023) et expose l’API Nest sur le port 80.
# Prérequis : Nest (ou Docker) écoute déjà sur 127.0.0.1:3000 ou 0.0.0.0:3000.
#
# Usage sur le serveur :
#   curl -fsSL ... | bash
# ou copier le dépôt et : sudo bash infra/scripts/ec2-install-nginx-proxy.sh
#
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Lancez avec sudo."
  exit 1
fi

if command -v dnf &>/dev/null; then
  dnf install -y nginx
elif command -v yum &>/dev/null; then
  yum install -y nginx
else
  echo "Gestionnaire de paquets non supporté (dnf/yum attendu)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SRC="${SCRIPT_DIR}/../nginx/pos-api.conf"
CONF_DST="/etc/nginx/conf.d/pos-api.conf"

MINIMAL_SRC="${SCRIPT_DIR}/../nginx/nginx-minimal.conf"
if [[ -f "$MINIMAL_SRC" ]]; then
  cp -f /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.bak.$(date +%s)" 2>/dev/null || true
  cp -f "$MINIMAL_SRC" /etc/nginx/nginx.conf
fi

if [[ -f "$CONF_SRC" ]]; then
  cp -f "$CONF_SRC" "$CONF_DST"
else
  cat >"$CONF_DST" <<'NGINX_CONF'
server {
    listen 80;
    listen [::]:80;
    server_name _;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
NGINX_CONF
fi

nginx -t
systemctl enable nginx
systemctl restart nginx
echo "OK — Nginx écoute sur :80 et proxy vers http://127.0.0.1:3000"
curl -s -o /dev/null -w "Test local port 80: HTTP %{http_code}\n" "http://127.0.0.1/auth/setup-status" || true
