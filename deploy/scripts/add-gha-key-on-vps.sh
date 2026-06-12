#!/usr/bin/env bash
# Run ONCE on VPS as vmadmin (after SSH login with password):
#   bash add-gha-key-on-vps.sh
set -euo pipefail
KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHkHJzwj2zZ5ojXAfkf4Hag4OAvdTdS4mQo9VVW/MbH0 github-actions-fitcity'
mkdir -p ~/.ssh
chmod 700 ~/.ssh
if ! grep -qxF "${KEY}" ~/.ssh/authorized_keys 2>/dev/null; then
  echo "${KEY}" >> ~/.ssh/authorized_keys
fi
chmod 600 ~/.ssh/authorized_keys
echo "OK: GitHub Actions deploy key added to authorized_keys"
