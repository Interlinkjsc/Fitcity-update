#!/usr/bin/env bash
# Chạy trên VPS (sau khi đã deploy Docker):
#   bash deploy/scripts/seed-admin-on-vps.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fitcity/app}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker/docker-compose.yml}"

cd "${APP_DIR}"
git fetch origin
git reset --hard origin/developer

docker compose -f "${COMPOSE_FILE}" up -d --build app
docker compose -f "${COMPOSE_FILE}" exec -T app node src/seeds/seedAdmin.js

echo "Done. Login: http://$(hostname -I | awk '{print $1}'):3000/auth/login"
