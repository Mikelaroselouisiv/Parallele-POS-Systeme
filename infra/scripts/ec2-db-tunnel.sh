#!/usr/bin/env bash
# Tunnel SSH vers Postgres sur EC2. Usage:
#   chmod +x infra/scripts/ec2-db-tunnel.sh
#   ./infra/scripts/ec2-db-tunnel.sh ~/.ssh/key.pem 3.x.x.x
set -euo pipefail
PEM="${1:?chemin vers .pem requis}"
HOST="${2:?IP ou DNS EC2 requis}"
USER="${3:-ec2-user}"
LOCAL_PORT="${4:-15432}"
echo "Tunnel: 127.0.0.1:${LOCAL_PORT} -> ${HOST}:5432 (${USER}). Ctrl+C pour arrêter."
exec ssh -i "$PEM" -N -L "${LOCAL_PORT}:127.0.0.1:5432" "${USER}@${HOST}"
