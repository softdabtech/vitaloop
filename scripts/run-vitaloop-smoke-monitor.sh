#!/usr/bin/env bash
set -euo pipefail

FRONTEND_DIR="${VITALOOP_FRONTEND_DIR:-/var/www/VITALOOP/frontend}"
LOG_PREFIX="${VITALOOP_SMOKE_LOG_PREFIX:-vitaloop-smoke}"

cd "$FRONTEND_DIR"

if [[ -z "${VITALOOP_SMOKE_SUPABASE_URL:-}" ]]; then
  VITALOOP_SMOKE_SUPABASE_URL="$(
    grep -Rho 'https://[a-z0-9]*\.supabase\.co' dist/assets/*.js 2>/dev/null | head -n 1 || true
  )"
  export VITALOOP_SMOKE_SUPABASE_URL
fi

if [[ -z "${VITALOOP_SMOKE_SUPABASE_ANON_KEY:-}" ]]; then
  VITALOOP_SMOKE_SUPABASE_ANON_KEY="$(
    grep -Rho 'eyJ[A-Za-z0-9_=-]*\.[A-Za-z0-9_=-]*\.[A-Za-z0-9_=-]*' dist/assets/*.js 2>/dev/null \
      | awk 'length($0) > 100' \
      | head -n 1 || true
  )"
  export VITALOOP_SMOKE_SUPABASE_ANON_KEY
fi

echo "{\"event\":\"${LOG_PREFIX}.start\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"has_supabase_url\":$([[ -n "${VITALOOP_SMOKE_SUPABASE_URL:-}" ]] && echo true || echo false),\"has_supabase_anon\":$([[ -n "${VITALOOP_SMOKE_SUPABASE_ANON_KEY:-}" ]] && echo true || echo false)}"

exec /usr/bin/node scripts/vitaloop-smoke-monitor.mjs
