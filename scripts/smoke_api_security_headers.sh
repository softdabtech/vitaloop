#!/bin/bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-https://api.vitaloop.today}"
HEALTH_URL="${API_BASE_URL%/}/health"

echo "Checking ${HEALTH_URL}"

TMP_HEADERS="$(mktemp)"
TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_HEADERS" "$TMP_BODY"' EXIT

curl -sS -D "$TMP_HEADERS" -o "$TMP_BODY" "$HEALTH_URL" >/dev/null

STATUS_LINE="$(head -n 1 "$TMP_HEADERS")"
echo "${STATUS_LINE}"

require_header() {
    local header_name="$1"
    if ! grep -qi "^${header_name}:" "$TMP_HEADERS"; then
        echo "Missing required header: ${header_name}" >&2
        return 1
    fi
    echo "ok: ${header_name}"
}

require_header "x-request-id"
require_header "x-content-type-options"
require_header "x-frame-options"
require_header "referrer-policy"
require_header "permissions-policy"
require_header "cache-control"

echo "API header smoke check passed"
