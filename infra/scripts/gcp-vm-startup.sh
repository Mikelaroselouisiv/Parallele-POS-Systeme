#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose nginx

systemctl enable --now docker

install -d -m 0750 -o "$(logname 2>/dev/null || echo root)" -g docker /opt/pos

cat >/etc/nginx/sites-available/pos-api <<'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
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

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/pos-api /etc/nginx/sites-enabled/pos-api
nginx -t
systemctl enable nginx
systemctl restart nginx
