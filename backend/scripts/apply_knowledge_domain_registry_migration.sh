#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_SQL="$ROOT_DIR/migrations/20260712225326_create_knowledge_domain_registry.sql"
ENV_FILE="${1:-}"

if [[ ! -f "$MIGRATION_SQL" ]]; then
  echo "Missing migration file: $MIGRATION_SQL" >&2
  exit 1
fi

if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing env file: $ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required. Pass an env file or export DATABASE_URL explicitly." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed" >&2
  exit 1
fi

echo "Applying knowledge domain registry migration..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_SQL"
echo "Done."
