#!/usr/bin/env bash
# Read-only release gate. It calls the service-role-only migration RPC and never
# prints credentials, response bodies, or database data.
set -euo pipefail

expected_contract="20261016120000_atomic_lab_analysis_finalization"
base_url="${SUPABASE_URL:-}"
service_key="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ ! "$base_url" =~ ^https://[^[:space:]]+$ ]] || [[ -z "$service_key" ]]; then
  echo "Atomic-finalization schema preflight is not configured." >&2
  exit 1
fi

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT
status="$({ curl --silent --show-error --output "$response_file" --write-out '%{http_code}' \
  --request POST "${base_url%/}/rest/v1/rpc/atomic_finalization_schema_preflight" \
  --header "apikey: $service_key" \
  --header "Authorization: Bearer $service_key" \
  --header 'Content-Type: application/json' \
  --data '{}' \
  --max-time 20; } || true)"

if [[ "$status" != "200" ]]; then
  echo "Atomic-finalization schema preflight failed." >&2
  exit 1
fi

python3 -c '
import json, sys
with open(sys.argv[1], encoding="utf-8") as source:
    result = json.load(source)
if not isinstance(result, dict) or result.get("schema_ready") is not True or result.get("migration_contract") != sys.argv[2]:
    raise SystemExit("Atomic-finalization schema preflight returned an invalid contract.")
' "$response_file" "$expected_contract"

echo "Atomic-finalization schema preflight passed."
