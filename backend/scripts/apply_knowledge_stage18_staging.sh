#!/usr/bin/env bash
set -euo pipefail

# Applies Stage 18 knowledge base foundation migration to staging ONLY.
# Required env:
#   STAGING_DATABASE_URL
# Optional env (recommended):
#   STAGING_API_URL

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_SQL="$ROOT_DIR/sql/stage-18-knowledge-base-foundation.sql"

if [[ ! -f "$MIGRATION_SQL" ]]; then
  echo "Missing migration file: $MIGRATION_SQL" >&2
  exit 1
fi

if [[ -z "${STAGING_DATABASE_URL:-}" ]]; then
  echo "STAGING_DATABASE_URL is required" >&2
  exit 1
fi

_extract_host() {
  local raw="$1"
  local no_scheme="${raw#*://}"
  local host_port_path="${no_scheme%%/*}"
  local host_port

  if [[ "$host_port_path" == *"@"* ]]; then
    host_port="${host_port_path#*@}"
  else
    host_port="$host_port_path"
  fi

  local host="${host_port%%:*}"
  printf '%s' "$host"
}

_looks_like_production_api() {
  local host
  host="$(_extract_host "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$host" == "api.vitaloop.today" ]] || [[ "$host" == "vitaloop.today" ]] || [[ "$host" == "www.vitaloop.today" ]]
}

_looks_like_production_db() {
  local raw
  raw="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$raw" == *"prod"* ]] || [[ "$raw" == *"production"* ]]
}

# Simple safety guard: refuse obvious production URLs.
if _looks_like_production_db "$STAGING_DATABASE_URL"; then
  echo "Refusing to run: STAGING_DATABASE_URL looks like production" >&2
  exit 1
fi

if [[ -n "${STAGING_API_URL:-}" ]]; then
  if _looks_like_production_api "$STAGING_API_URL"; then
    echo "Refusing to run: STAGING_API_URL points to production domain" >&2
    exit 1
  fi
else
  echo "STAGING_API_URL is not set: running DB-only rollout mode (API smoke can be run later)."
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed" >&2
  exit 1
fi

echo "Applying Stage 18 knowledge base foundation migration to staging..."
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_SQL"

echo "Running post-migration structural checks..."
for table_name in knowledge_rules lab_markers rule_evaluations knowledge_chunks; do
  exists=$(psql "$STAGING_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "select to_regclass('public.${table_name}') is not null;")
  if [[ "$exists" != "t" ]]; then
    echo "Post-migration check failed: table public.${table_name} not found" >&2
    exit 1
  fi
  echo "ok: table public.${table_name} exists"
done

echo "Running post-migration seed checks..."
seed_marker_count=$(psql "$STAGING_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from public.lab_markers where key in ('glucose','hba1c','vitamin_d','ferritin','tsh','alt','ast','ldl','hdl','triglycerides');")
if [[ "${seed_marker_count}" -lt 10 ]]; then
  echo "Post-migration check failed: expected >=10 seed lab_markers, got ${seed_marker_count}" >&2
  exit 1
fi
echo "ok: seed lab_markers count=${seed_marker_count}"

starter_rules_count=$(psql "$STAGING_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from public.knowledge_rules where key in ('rule_low_ferritin_fatigue','rule_low_vitamin_d','rule_high_hba1c','rule_high_alt_or_ast','rule_high_ldl');")
if [[ "${starter_rules_count}" -lt 5 ]]; then
  echo "Post-migration check failed: expected >=5 starter knowledge_rules, got ${starter_rules_count}" >&2
  exit 1
fi
echo "ok: starter knowledge_rules count=${starter_rules_count}"

echo "Stage 18 foundation migration applied successfully."
echo "Do NOT apply stage-18-knowledge-pgvector-optional.sql yet (wait for ingestion/embeddings pipeline)."
