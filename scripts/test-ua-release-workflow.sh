#!/usr/bin/env bash
# Fast, credential-free guard for the UA release contract.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_SCRIPT="$PROJECT_ROOT/scripts/deploy-ua-frontend-dist.sh"
BOOTSTRAP_SCRIPT="$PROJECT_ROOT/scripts/bootstrap-ua-atomic-releases.sh"
NGINX_CONFIG="$PROJECT_ROOT/ops/nginx/ua.vitaloop.today.conf"

bash -n "$DEPLOY_SCRIPT"
bash -n "$BOOTSTRAP_SCRIPT"

grep -q 'root /var/www/UAVITALOOP/frontend/current;' "$NGINX_CONFIG"
grep -q 'add_header Cache-Control "no-cache, no-store, must-revalidate" always;' "$NGINX_CONFIG"
grep -q 'mv -Tf.*current' "$DEPLOY_SCRIPT"
grep -q 'rollback()' "$DEPLOY_SCRIPT"
grep -q 'release.json' "$DEPLOY_SCRIPT"

echo 'UA release workflow contract: OK'
