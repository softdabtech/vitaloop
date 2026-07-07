# VITALOOP B2B API Smoke Test Guide

Run these checks against staging before giving a partner access.

## Environment

```bash
export VITALOOP_B2B_BASE_URL="https://staging-api.vitaloop.today"
export VITALOOP_PARTNER_API_KEY="<partner-api-key>"
```

Do not commit real API keys.

## 1. Valid Key

```bash
curl -sS -X POST "$VITALOOP_B2B_BASE_URL/v1/b2b/analyze-labs" \
  -H "X-Partner-Api-Key: $VITALOOP_PARTNER_API_KEY" \
  -H "X-Idempotency-Key: smoke-valid-001" \
  -H "Content-Type: application/json" \
  --data @docs/partner-api-package/examples/analyze-labs-request.json
```

Expected:

- HTTP `200`
- `status=completed`
- `analysis_id` present
- `disclaimer` present
- `protocol` present

## 2. Invalid Key

```bash
curl -i -sS -X POST "$VITALOOP_B2B_BASE_URL/v1/b2b/analyze-labs" \
  -H "X-Partner-Api-Key: invalid-test-key" \
  -H "Content-Type: application/json" \
  --data @docs/partner-api-package/examples/analyze-labs-request.json
```

Expected: HTTP `401`.

## 3. Idempotency Replay

Run the valid request twice with the same `X-Idempotency-Key`.

Expected:

- First request: HTTP `200`.
- Second request: HTTP `200` with same analysis result, or HTTP `409` if the first request is still processing.
- Completed replay should include `metadata.idempotent_replay=true`.

## 4. Wrong Unit

```bash
curl -i -sS -X POST "$VITALOOP_B2B_BASE_URL/v1/b2b/analyze-labs" \
  -H "X-Partner-Api-Key: $VITALOOP_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"external_user_id":"smoke-wrong-unit","biomarkers":[{"name":"Ferritin","value":12,"unit":"bananas"}]}'
```

Expected: HTTP `422` with `INVALID_BIOMARKER_UNIT`.

## 5. Rate Limit

Send repeated valid requests with unique idempotency keys until the configured partner/API-key limit is reached.

Expected: HTTP `429` with `RATE_LIMITED` once the configured Redis-backed limit is exceeded.

## 6. Versioned Endpoint

Always use:

```http
POST /v1/b2b/analyze-labs
```

The legacy alias `/b2b/analyze-labs` exists for pilot compatibility only.
