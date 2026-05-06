#!/bin/bash
# Deploy only the built frontend (dist) from local to server
# Usage: ./deploy-frontend-dist.sh

set -e

LOCAL_DIST_DIR="$(cd "$(dirname "$0")/../frontend/dist" && pwd)"
REMOTE_HOST="root@159.65.252.227"
REMOTE_DIST_DIR="/var/www/VITALOOP/frontend/dist/"

# Rsync dist to server (delete removed files, preserve permissions)
rsync -az --delete -e "ssh -i ~/.ssh/softdab_new" "$LOCAL_DIST_DIR/" "$REMOTE_HOST:$REMOTE_DIST_DIR"

# Reload nginx to clear any caches
ssh -i ~/.ssh/softdab_new "$REMOTE_HOST" 'systemctl reload nginx'

echo "✅ Frontend dist deployed to $REMOTE_HOST:$REMOTE_DIST_DIR"
