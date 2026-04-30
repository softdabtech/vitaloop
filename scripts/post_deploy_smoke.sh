#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_DIR="${ROOT_DIR}/scripts/smoke-fixtures"

API_BASE_URL="${API_BASE_URL:-https://api.vitaloop.today}"
ANALYZE_BASE_URL="${ANALYZE_BASE_URL:-https://vitaloop.today}"
ANALYZE_ENDPOINT="${ANALYZE_BASE_URL%/}/api/v1/analyze"
HEALTH_ENDPOINT="${API_BASE_URL%/}/health"

PDF_FIXTURE="${PDF_FIXTURE:-${FIXTURE_DIR}/lab_ocr_test_big.pdf}"
IMAGE_FIXTURE="${IMAGE_FIXTURE:-${FIXTURE_DIR}/lab_ocr_test_big.png}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "Missing fixture file: ${path}" >&2
    exit 2
  fi
}

check_health() {
  local out_file="${TMP_DIR}/health.json"
  local status
  status="$(curl -sS -o "${out_file}" -w "%{http_code}" "${HEALTH_ENDPOINT}")"
  if [[ "${status}" != "200" ]]; then
    echo "Health check failed: ${HEALTH_ENDPOINT} (status=${status})" >&2
    cat "${out_file}" >&2 || true
    exit 1
  fi
  echo "ok: health ${HEALTH_ENDPOINT}"
}

run_analyze() {
  local label="$1"
  local file_path="$2"
  local content_type="$3"
  local body_file="$4"

  local status
  status="$(curl -sS -o "${body_file}" -w "%{http_code}" -X POST "${ANALYZE_ENDPOINT}" -F "file=@${file_path};type=${content_type}")"
  if [[ "${status}" != "200" ]]; then
    echo "Analyze ${label} failed: status=${status}" >&2
    cat "${body_file}" >&2 || true
    exit 1
  fi

  local biomarkers_count
  biomarkers_count="$(python3 - "${body_file}" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
biomarkers = data.get('biomarkers')
if not isinstance(biomarkers, list):
    print(-1)
else:
    print(len(biomarkers))
PY
)"

  if [[ "${biomarkers_count}" -le 0 ]]; then
    echo "Analyze ${label} returned empty biomarkers" >&2
    cat "${body_file}" >&2 || true
    exit 1
  fi

  echo "ok: ${label} biomarkers=${biomarkers_count}"
}

echo "Post-deploy smoke started"
echo "API_BASE_URL=${API_BASE_URL}"
echo "ANALYZE_BASE_URL=${ANALYZE_BASE_URL}"

require_file "${PDF_FIXTURE}"
require_file "${IMAGE_FIXTURE}"

check_health
run_analyze "pdf" "${PDF_FIXTURE}" "application/pdf" "${TMP_DIR}/pdf.json"
run_analyze "image" "${IMAGE_FIXTURE}" "image/png" "${TMP_DIR}/image.json"

echo "PASS: post-deploy smoke completed"
