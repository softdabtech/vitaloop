#!/bin/bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/VITALOOP}"
SSH_OPTS="${SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3}"

if [[ -z "${REMOTE_HOST}" ]]; then
    echo "REMOTE_HOST is not set. Export REMOTE_HOST before running." >&2
    exit 1
fi

echo "Installing retention timer on ${REMOTE_HOST}"

ssh ${SSH_OPTS} "${REMOTE_HOST}" "
set -euo pipefail
cp '${REMOTE_DIR}/ops/systemd/vitaloop-retention-redaction.service' /etc/systemd/system/
cp '${REMOTE_DIR}/ops/systemd/vitaloop-retention-redaction.timer' /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now vitaloop-retention-redaction.timer
systemctl status --no-pager vitaloop-retention-redaction.timer | head -n 20
"

echo "Retention timer installed and started"
