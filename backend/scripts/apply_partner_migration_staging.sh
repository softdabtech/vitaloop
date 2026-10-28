#!/usr/bin/env bash
set -euo pipefail

# Applies partner migration to staging ONLY.
# Required env: STAGING_DATABASE_URL

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_SQL="$ROOT_DIR/sql/stage-17-partner-integration-mvp.sql"

if [[ ! -f "$MIGRATION_SQL" ]]; then
  echo "Missing migration file: $MIGRATION_SQL" >&2
  exit 1
fi

if [[ -z "${STAGING_DATABASE_URL:-}" ]]; then
  echo "STAGING_DATABASE_URL is required" >&2
  exit 1
fi

if [[ "$STAGING_DATABASE_URL" == *"prod"* ]] || [[ "$STAGING_DATABASE_URL" == *"production"* ]]; then
  echo "Refusing to run: STAGING_DATABASE_URL looks like production" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed" >&2
  exit 1
fi

echo "Applying partner migration to staging..."
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_SQL"

echo "Done."
