#!/bin/bash
# Deploy the Ukrainian frontend bundle to an isolated web root.
# Usage: ./scripts/deploy-ua-frontend-dist.sh

set -euo pipefail

LOCAL_DIST_DIR="$(cd "$(dirname "$0")/../frontend/dist" && pwd)"
REMOTE_HOST="root@159.65.252.227"
REMOTE_ROOT_DIR="/var/www/UAVITALOOP"
REMOTE_DIST_DIR="$REMOTE_ROOT_DIR/frontend/dist/"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ ! -f "$LOCAL_DIST_DIR/ua-index.html" ]]; then
  echo "Missing $LOCAL_DIST_DIR/ua-index.html. Run npm run build in frontend first." >&2
  exit 1
fi

rsync -a --delete "$LOCAL_DIST_DIR/" "$TMP_DIR/"
cp "$TMP_DIR/ua-index.html" "$TMP_DIR/index.html"
[[ -f "$TMP_DIR/ua-sitemap.xml" ]] && cp "$TMP_DIR/ua-sitemap.xml" "$TMP_DIR/sitemap.xml"
[[ -f "$TMP_DIR/ua-robots.txt" ]] && cp "$TMP_DIR/ua-robots.txt" "$TMP_DIR/robots.txt"
[[ -f "$TMP_DIR/ua-llms.txt" ]] && cp "$TMP_DIR/ua-llms.txt" "$TMP_DIR/llms.txt"
if [[ -d "$TMP_DIR/ua-static" ]]; then
  rsync -a "$TMP_DIR/ua-static/" "$TMP_DIR/"
fi

if ! grep -q 'https://ua.vitaloop.today/sitemap.xml' "$TMP_DIR/robots.txt"; then
  echo "UA deploy preflight failed: robots.txt does not point to the UA sitemap." >&2
  exit 1
fi

if grep -q 'https://vitaloop.today/health-hub' "$TMP_DIR/sitemap.xml"; then
  echo "UA deploy preflight failed: sitemap.xml contains EN Health Hub URLs." >&2
  exit 1
fi

if ! grep -qi '<title>Тарифи VITALOOP Україна' "$TMP_DIR/tarify/index.html"; then
  echo "UA deploy preflight failed: tarify/index.html does not contain a Ukrainian title." >&2
  exit 1
fi

if ! grep -qi '<title>Питання та відповіді' "$TMP_DIR/faq/index.html"; then
  echo "UA deploy preflight failed: faq/index.html does not contain a Ukrainian title." >&2
  exit 1
fi

ssh -i ~/.ssh/softdab_new "$REMOTE_HOST" "mkdir -p '$REMOTE_DIST_DIR'"
rsync -az --delete -e "ssh -i ~/.ssh/softdab_new" "$TMP_DIR/" "$REMOTE_HOST:$REMOTE_DIST_DIR"
ssh -i ~/.ssh/softdab_new "$REMOTE_HOST" "set -euo pipefail
  UA_NGINX='/etc/nginx/sites-available/ua.vitaloop.today'
  if ! grep -q 'location = /pricing/' \"\$UA_NGINX\"; then
    cp \"\$UA_NGINX\" \"/root/vitaloop-release-backups/ua-nginx-pricing-redirect-\$(date -u +%Y%m%d%H%M%S).conf\"
    python3 - <<'PY'
from pathlib import Path
path = Path('/etc/nginx/sites-available/ua.vitaloop.today')
text = path.read_text()
insert = '''\\n    location = /pricing {\\n        return 301 /tarify/;\\n    }\\n\\n    location = /pricing/ {\\n        return 301 /tarify/;\\n    }\\n'''
anchor = '    location = /index.html {'
if 'location = /pricing/' not in text:
    text = text.replace(anchor, insert + '\\n' + anchor, 1)
    path.write_text(text)
PY
  fi
  nginx -t
  chown -R www-data:www-data '$REMOTE_ROOT_DIR'
  systemctl reload nginx"

echo "✅ UA frontend dist deployed to $REMOTE_HOST:$REMOTE_DIST_DIR"
