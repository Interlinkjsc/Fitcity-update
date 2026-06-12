#!/usr/bin/env bash
# Build and start FitCity stack on VPS (run as vmadmin from repo root)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/deploy/docker/docker-compose.yml"
ENV_FILE="/opt/fitcity/env/.env.production"

cd "${REPO_ROOT}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} — complete Phase 0 env setup first."
  exit 1
fi

echo "==> Building and starting containers"
docker compose -f "${COMPOSE_FILE}" up -d --build

echo "==> Status"
docker compose -f "${COMPOSE_FILE}" ps

echo ""
echo "==> Health (wait ~60s if starting)"
curl -sf "http://127.0.0.1:3000/health" && echo "" || echo "Health not ready yet — check: docker compose -f ${COMPOSE_FILE} logs -f app"
