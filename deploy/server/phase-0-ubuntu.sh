#!/usr/bin/env bash
# FitCity Phase 0 — Ubuntu 22.04 VPS bootstrap
# Installs: Docker Engine + Compose plugin, basic UFW rules
# Does NOT: upgrade OS, deploy app, install Mongo, configure TLS
#
# Usage (review first):
#   chmod +x phase-0-ubuntu.sh
#   sudo ./phase-0-ubuntu.sh
#
# Requires: Ubuntu 22.04 (or compatible), curl, sudo

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

echo "==> FitCity Phase 0 bootstrap"

if ! grep -q '22.04' /etc/os-release 2>/dev/null; then
  echo "WARNING: This script targets Ubuntu 22.04. Current:"
  grep PRETTY_NAME /etc/os-release || true
  read -r -p "Continue anyway? [y/N] " ans
  [[ "${ans:-N}" =~ ^[Yy]$ ]] || exit 1
fi

echo "==> Apt update"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw

echo "==> Docker (official repo)"
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

echo "==> UFW (22, 80, 443 only)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "==> Deploy directories"
mkdir -p /opt/fitcity/{app,env,secrets}
mkdir -p /var/log/fitcity
chmod 750 /opt/fitcity/secrets

DEPLOY_USER="${SUDO_USER:-}"
if [[ -n "${DEPLOY_USER}" && "${DEPLOY_USER}" != "root" ]]; then
  usermod -aG docker "${DEPLOY_USER}"
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /opt/fitcity/app /opt/fitcity/env /var/log/fitcity 2>/dev/null || true
  echo "Added ${DEPLOY_USER} to group docker (re-login SSH to apply)."
fi

echo "==> Verify"
docker --version
docker compose version
ufw status verbose

echo ""
echo "Phase 0 script done. Next:"
echo "  1. Copy deploy/env/.env.production.example -> /opt/fitcity/env/.env.production"
echo "  2. Install Node 20 + Mongo (or wait for Phase 1 Docker Compose)"
echo "  3. Complete docs/devops/phase-0/checklist.md"
