#!/usr/bin/env bash
set -euo pipefail

# Safe backend deploy script for production.
# Prevents accidental deletion of server-managed secret files.

SERVER="${SERVER:-}"
LOCAL_ROOT="${LOCAL_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/VITALOOP}"
REMOTE_BACKEND="${REMOTE_ROOT}/backend"
CANONICAL_ENV="${CANONICAL_ENV:-/etc/vitaloop/backend.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/vitaloop-backend}"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}"
BACKUP_ARCHIVE="${BACKUP_ROOT}/backend-${RELEASE_ID}.tgz"
ROLLBACK_ON_FAIL="${ROLLBACK_ON_FAIL:-1}"

if [[ ! -d "${LOCAL_ROOT}/backend" ]]; then
  echo "Local backend directory not found at ${LOCAL_ROOT}/backend" >&2
  exit 1
fi

if [[ -z "${SERVER}" ]]; then
  echo "SERVER is not set. Export SERVER (for example, deploy@your-host) before running this script." >&2
  exit 1
fi

for cmd in ssh rsync; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Required command not found: ${cmd}" >&2
    exit 1
  fi
done

echo "[1/5] Preflight checks on server"
ssh "${SERVER}" "
  set -euo pipefail
  test -d '${REMOTE_BACKEND}'
  test -f '${CANONICAL_ENV}'
  mkdir -p /etc/vitaloop
  mkdir -p '${BACKUP_ROOT}'
  tar --exclude='.venv' -czf '${BACKUP_ARCHIVE}' -C '${REMOTE_BACKEND}' .
  test -s '${BACKUP_ARCHIVE}'
"
echo "Backup created: ${BACKUP_ARCHIVE}"

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
if ssh "${SERVER}" "
  set -euo pipefail
  systemctl is-active vitaloop-backend
  for i in {1..20}; do
    if curl -fsS http://127.0.0.1:8004/health >/dev/null; then
      break
    fi
    sleep 1
  done
  curl -fsS http://127.0.0.1:8004/health >/dev/null
  echo 'backend deploy ok'
"; then
  echo "Deploy completed successfully."
else
  echo "Smoke checks failed."

  if [[ "${ROLLBACK_ON_FAIL}" != "1" ]]; then
    echo "Automatic rollback is disabled (ROLLBACK_ON_FAIL=${ROLLBACK_ON_FAIL})." >&2
    exit 1
  fi

  echo "Starting automatic rollback from ${BACKUP_ARCHIVE}"
  ssh "${SERVER}" "
    set -euo pipefail
    test -f '${BACKUP_ARCHIVE}'
    find '${REMOTE_BACKEND}' -mindepth 1 -maxdepth 1 ! -name '.venv' -exec rm -rf {} +
    tar -xzf '${BACKUP_ARCHIVE}' -C '${REMOTE_BACKEND}'
    rm -f '${REMOTE_BACKEND}/.env'
    ln -s '${CANONICAL_ENV}' '${REMOTE_BACKEND}/.env'
    chown -h root:root '${REMOTE_BACKEND}/.env'
    chown root:www-data '${CANONICAL_ENV}'
    chmod 640 '${CANONICAL_ENV}'
    chown -R www-data:www-data '${REMOTE_BACKEND}'
    cd '${REMOTE_BACKEND}'
    .venv/bin/pip install -q -r requirements.txt
    systemctl restart vitaloop-backend
    systemctl is-active vitaloop-backend
    for i in {1..20}; do
      if curl -fsS http://127.0.0.1:8004/health >/dev/null; then
        break
      fi
      sleep 1
    done
    curl -fsS http://127.0.0.1:8004/health >/dev/null
    echo 'rollback completed and backend is healthy'
  "
fi
