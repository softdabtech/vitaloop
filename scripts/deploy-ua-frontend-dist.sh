#!/usr/bin/env bash
# Deploy an already-built UA frontend as an immutable, atomically switched release.
# Run scripts/bootstrap-ua-atomic-releases.sh once before the first deploy.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIST_DIR="$PROJECT_ROOT/frontend/dist"
REMOTE_HOST="${REMOTE_HOST:-root@159.65.252.227}"
REMOTE_ROOT_DIR="${REMOTE_ROOT_DIR:-/var/www/UAVITALOOP}"
REMOTE_FRONTEND_DIR="$REMOTE_ROOT_DIR/frontend"
REMOTE_RELEASES_DIR="$REMOTE_FRONTEND_DIR/releases"
REMOTE_CURRENT_LINK="$REMOTE_FRONTEND_DIR/current"
SSH_KEY="${SSH_KEY:-}"
RELEASE_ID="${RELEASE_ID:-$(git -C "$PROJECT_ROOT" rev-parse --short=12 HEAD)-$(date -u +%Y%m%d%H%M%S)}"
WORK_DIR="$(mktemp -d)"
STAGED_DIST="$WORK_DIR/dist"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

remote_ssh() {
  if [[ -n "$SSH_KEY" ]]; then
    ssh -i "$SSH_KEY" "$REMOTE_HOST" "$@"
  else
    ssh "$REMOTE_HOST" "$@"
  fi
}

if [[ ! -f "$LOCAL_DIST_DIR/ua-index.html" ]]; then
  echo "Missing $LOCAL_DIST_DIR/ua-index.html. Run npm run build in frontend first." >&2
  exit 1
fi

mkdir -p "$STAGED_DIST"
rsync -a --delete "$LOCAL_DIST_DIR/" "$STAGED_DIST/"
cp "$STAGED_DIST/ua-index.html" "$STAGED_DIST/index.html"
for name in sitemap.xml robots.txt llms.txt; do
  [[ -f "$STAGED_DIST/ua-$name" ]] && cp "$STAGED_DIST/ua-$name" "$STAGED_DIST/$name"
done
if [[ -d "$STAGED_DIST/ua-static" ]]; then
  rsync -a "$STAGED_DIST/ua-static/" "$STAGED_DIST/"
fi

if ! grep -q 'https://ua.vitaloop.today/sitemap.xml' "$STAGED_DIST/robots.txt"; then
  echo "UA deploy preflight failed: robots.txt does not point to the UA sitemap." >&2
  exit 1
fi
if grep -q 'https://vitaloop.today/health-hub' "$STAGED_DIST/sitemap.xml"; then
  echo "UA deploy preflight failed: sitemap.xml contains EN Health Hub URLs." >&2
  exit 1
fi
for page in tarify faq; do
  page_file="$STAGED_DIST/$page/index.html"
  if ! grep -q '<html lang="uk"' "$page_file" || ! grep -q "https://ua.vitaloop.today/$page/" "$page_file"; then
    echo "UA deploy preflight failed: $page/index.html is not a Ukrainian canonical page." >&2
    exit 1
  fi
done

commit="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
python3 - "$STAGED_DIST/release.json" "$RELEASE_ID" "$commit" <<'PY'
import json
import sys
from datetime import datetime, timezone

path, release_id, commit = sys.argv[1:]
with open(path, 'w', encoding='utf-8') as handle:
    json.dump({'release': release_id, 'commit': commit, 'createdAt': datetime.now(timezone.utc).isoformat()}, handle, indent=2)
    handle.write('\n')
PY

remote_ssh "set -euo pipefail
  test -L '$REMOTE_CURRENT_LINK' || { echo 'Run the atomic-release bootstrap first.' >&2; exit 1; }
  test ! -e '$REMOTE_RELEASES_DIR/$RELEASE_ID' || { echo 'Release already exists: $RELEASE_ID' >&2; exit 1; }
  mkdir -p '$REMOTE_RELEASES_DIR/.incoming-$RELEASE_ID'"

if [[ -n "$SSH_KEY" ]]; then
  RSYNC_SSH="ssh -i $SSH_KEY"
else
  RSYNC_SSH="ssh"
fi
rsync -az --delete -e "$RSYNC_SSH" "$STAGED_DIST/" "$REMOTE_HOST:$REMOTE_RELEASES_DIR/.incoming-$RELEASE_ID/"

remote_ssh "set -euo pipefail
  incoming='$REMOTE_RELEASES_DIR/.incoming-$RELEASE_ID'
  release='$REMOTE_RELEASES_DIR/$RELEASE_ID'
  previous=\$(readlink '$REMOTE_CURRENT_LINK')
  rollback() {
    ln -s \"\$previous\" '$REMOTE_FRONTEND_DIR/.current-rollback'
    mv -Tf '$REMOTE_FRONTEND_DIR/.current-rollback' '$REMOTE_CURRENT_LINK'
  }
  test -f \"\$incoming/index.html\"
  test -f \"\$incoming/build-info.json\"
  grep -q '$commit' \"\$incoming/release.json\"
  chown -R www-data:www-data \"\$incoming\"
  mv \"\$incoming\" \"\$release\"
  ln -s 'releases/$RELEASE_ID' '$REMOTE_FRONTEND_DIR/.current-next'
  mv -Tf '$REMOTE_FRONTEND_DIR/.current-next' '$REMOTE_CURRENT_LINK'
  if ! {
    for route in / /login /dashboard /build-info.json /release.json; do
      curl -fsSk --resolve ua.vitaloop.today:443:127.0.0.1 \"https://ua.vitaloop.today\$route\" >/dev/null
    done
    curl -fsSk --resolve ua.vitaloop.today:443:127.0.0.1 https://ua.vitaloop.today/release.json | grep -q '$commit'
    curl -fsSkI --resolve ua.vitaloop.today:443:127.0.0.1 https://ua.vitaloop.today/dashboard | grep -qi '^cache-control: no-cache'
  }; then
    rollback
    echo 'UA release smoke check failed; restored the previous release.' >&2
    exit 1
  fi"

echo "UA release $RELEASE_ID is live at $REMOTE_CURRENT_LINK"
