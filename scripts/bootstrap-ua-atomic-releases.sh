#!/usr/bin/env bash
# One-time, idempotent migration to an atomic UA frontend release root.

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-root@159.65.252.227}"
REMOTE_ROOT_DIR="${REMOTE_ROOT_DIR:-/var/www/UAVITALOOP}"
REMOTE_FRONTEND_DIR="$REMOTE_ROOT_DIR/frontend"
REMOTE_DIST_DIR="$REMOTE_FRONTEND_DIR/dist"
REMOTE_CURRENT_LINK="$REMOTE_FRONTEND_DIR/current"
UA_NGINX="/etc/nginx/sites-available/ua.vitaloop.today"
SSH_KEY="${SSH_KEY:-}"

if [[ -n "$SSH_KEY" ]]; then
  SSH_COMMAND=(ssh -i "$SSH_KEY")
else
  SSH_COMMAND=(ssh)
fi

"${SSH_COMMAND[@]}" "$REMOTE_HOST" "set -euo pipefail
  test -d '$REMOTE_DIST_DIR'
  if [[ ! -L '$REMOTE_CURRENT_LINK' ]]; then
    test ! -e '$REMOTE_CURRENT_LINK'
    ln -s dist '$REMOTE_CURRENT_LINK'
  fi
  mkdir -p /root/vitaloop-release-backups
  backup='/root/vitaloop-release-backups/ua-nginx-before-atomic-'\$(date -u +%Y%m%d%H%M%S)'.conf'
  cp '$UA_NGINX' \"\$backup\"
  python3 - <<'PY'
from pathlib import Path

path = Path('/etc/nginx/sites-available/ua.vitaloop.today')
before = 'root /var/www/UAVITALOOP/frontend/dist;'
after = 'root /var/www/UAVITALOOP/frontend/current;'
text = path.read_text()
if before in text:
    path.write_text(text.replace(before, after, 1))
elif after not in text:
    raise SystemExit('UA nginx root has an unexpected value; refusing to change it.')

text = path.read_text()
old = '''        try_files /index.html =404;
    }

    location / {
'''
quote = chr(34)
new = '''        include /etc/nginx/snippets/security-headers.conf;
        add_header Cache-Control ''' + quote + '''no-cache, no-store, must-revalidate''' + quote + ''' always;
        add_header Pragma ''' + quote + '''no-cache''' + quote + ''' always;
        add_header Expires ''' + quote + '''0''' + quote + ''' always;
        try_files /index.html =404;
    }

    location / {
'''
if old in text:
    path.write_text(text.replace(old, new, 1))
elif 'location ~ ^/(login|register|auth/confirmation|dashboard|' not in text:
    raise SystemExit('UA SPA location is missing; refusing to change cache headers.')
PY
  nginx -t
  systemctl reload nginx
  curl -fsSk --resolve ua.vitaloop.today:443:127.0.0.1 https://ua.vitaloop.today/ >/dev/null
  readlink -f '$REMOTE_CURRENT_LINK'
  echo \"Atomic release root is active; backup: \$backup\""
