#!/usr/bin/env bash
set -euo pipefail

# Safe backend deploy script for production.
# Prevents accidental deletion of server-managed secret files.

SERVER="${SERVER:-root@159.65.252.227}"
LOCAL_ROOT="${LOCAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/VITALOOP}"
REMOTE_BACKEND="${REMOTE_ROOT}/backend"
CANONICAL_ENV="${CANONICAL_ENV:-/etc/vitaloop/backend.env}"

if [[ ! -d "${LOCAL_ROOT}/backend" ]]; then
  echo "Local backend directory not found at ${LOCAL_ROOT}/backend" >&2
  exit 1
fi

echo "[1/5] Preflight checks on server"
ssh "${SERVER}" "
  set -euo pipefail
  test -d '${REMOTE_BACKEND}'
  test -f '${CANONICAL_ENV}'
  mkdir -p /etc/vitaloop
"

echo "[2/5] Rsync backend code (secret-safe excludes)"
rsync -az --delete \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.pem' \
  --exclude='*.key' \
  "${LOCAL_ROOT}/backend/" "${SERVER}:${REMOTE_BACKEND}/"

echo "[3/5] Enforce stable env linkage and permissions"
ssh "${SERVER}" "
  set -euo pipefail
  chown root:www-data '${CANONICAL_ENV}'
  chmod 640 '${CANONICAL_ENV}'
  rm -f '${REMOTE_BACKEND}/.env'
  ln -s '${CANONICAL_ENV}' '${REMOTE_BACKEND}/.env'
  chown -h root:root '${REMOTE_BACKEND}/.env'
  chown -R www-data:www-data '${REMOTE_BACKEND}'
"

echo "[4/5] Install dependencies and restart service"
ssh "${SERVER}" "
  set -euo pipefail
  cd '${REMOTE_BACKEND}'
  .venv/bin/pip install -q -r requirements.txt
  systemctl daemon-reload
  systemctl restart vitaloop-backend
"

echo "[5/5] Smoke checks"
ssh "${SERVER}" "
  set -euo pipefail
  systemctl is-active vitaloop-backend
  curl -fsS http://127.0.0.1:8004/health >/dev/null
  echo 'backend deploy ok'
"
