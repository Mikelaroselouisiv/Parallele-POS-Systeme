#!/usr/bin/env bash
# Déploie la stack GCP sur la VM (pull image + compose up).
# Appelé par .github/workflows/backend-gcp.yml après push Artifact Registry.
#
# Variables requises :
#   GCP_PROJECT_ID, GCP_VM_NAME, GCP_VM_ZONE
# Optionnel :
#   GCP_REMOTE_DIR (défaut /opt/pos)

set -euo pipefail

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID requis}"
: "${GCP_VM_NAME:?GCP_VM_NAME requis}"
: "${GCP_VM_ZONE:?GCP_VM_ZONE requis}"

REMOTE_DIR="${GCP_REMOTE_DIR:-/opt/pos}"
COMPOSE_LOCAL="infra/docker/docker-compose.gcp.yml"
COMPOSE_REMOTE="${REMOTE_DIR}/docker-compose.gcp.yml"

if [[ ! -f "${COMPOSE_LOCAL}" ]]; then
  echo "Fichier introuvable: ${COMPOSE_LOCAL}" >&2
  exit 1
fi

echo "==> Copie ${COMPOSE_LOCAL} → ${GCP_VM_NAME}:${COMPOSE_REMOTE}"
gcloud compute scp "${COMPOSE_LOCAL}" \
  "${GCP_VM_NAME}:/tmp/docker-compose.gcp.yml" \
  --zone="${GCP_VM_ZONE}" \
  --project="${GCP_PROJECT_ID}"

echo "==> Déploiement sur ${GCP_VM_NAME} (${GCP_VM_ZONE})"
gcloud compute ssh "${GCP_VM_NAME}" \
  --zone="${GCP_VM_ZONE}" \
  --project="${GCP_PROJECT_ID}" \
  --command="set -euo pipefail
    REMOTE_DIR='${REMOTE_DIR}'
    sudo cp /tmp/docker-compose.gcp.yml \"\${REMOTE_DIR}/docker-compose.gcp.yml\"
    cd \"\${REMOTE_DIR}\"
    if command -v gcloud >/dev/null 2>&1; then
      sudo gcloud auth configure-docker northamerica-northeast1-docker.pkg.dev --quiet || true
    fi
    COMPOSE_CMD=docker-compose
    if ! command -v docker-compose >/dev/null 2>&1; then COMPOSE_CMD='docker compose'; fi
    if [[ ! -f .env.prod ]]; then
      echo 'Erreur: .env.prod manquant' >&2
      exit 1
    fi
    sudo \$COMPOSE_CMD -f docker-compose.gcp.yml --env-file .env.prod pull
    sudo \$COMPOSE_CMD -f docker-compose.gcp.yml --env-file .env.prod up -d --force-recreate backend
    sudo \$COMPOSE_CMD -f docker-compose.gcp.yml ps"

echo "==> Déploiement GCP terminé"
