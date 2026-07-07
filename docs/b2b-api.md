# VITALOOP B2B Analyze Labs API

This document describes the JSON-only MVP for external platforms that send parsed lab biomarkers to VITALOOP and receive a structured analysis response.

Pilot scope: this API is intended for a controlled external pilot with 1-2 trusted partners. It is not a public self-serve SaaS API yet.

## Auth

Use a partner API key in every request:

```http
X-Partner-Api-Key: ptk_live_or_staging_key
X-Idempotency-Key: optional-client-request-id
Content-Type: application/json
```

Required API key scope:

```text
labs:analyze
```

The client does not send `partner_id`. VITALOOP resolves `partner_id`, `partner_slug`, `api_key_id`, status, expiration, and scopes from `X-Partner-Api-Key`.

Production pilot requirement: configure Redis-backed rate limiting with `RATE_LIMIT_REDIS_URL`. In production-like environments the B2B endpoint should not run on per-process in-memory limits.

For public launch, put Cloudflare WAF in front of the API and route B2B traffic through Cloudflare. Partners can be configured with `b2b_require_cloudflare=true`; those requests must include Cloudflare edge headers such as `CF-Ray` and `CF-Connecting-IP`.

## Endpoint

```http
POST /v1/b2b/analyze-labs
```

If this is exposed through the public API proxy, the external URL is expected to be:

```http
POST https://api.vitaloop.today/v1/b2b/analyze-labs
```

Pilot compatibility alias:

```http
POST /b2b/analyze-labs
```

The alias should not be advertised for public integrations.

## Request

```json
{
  "external_user_id": "partner-user-123",
  "biomarkers": [
    {
      "name": "Ferritin",
      "value": 12,
      "unit": "ng/mL",
      "reference_range": "30-150",
      "collected_at": "2026-07-01T09:00:00Z",
      "lab_name": "Partner Lab"
    },
    {
      "name": "Glucose",
      "value": 92,
      "unit": "mg/dL",
      "reference_range": "70-100"
    }
  ],
  "symptoms": ["fatigue", "low energy"],
  "questionnaire": {
    "sleep_hours": 6,
    "diet": "mixed"
  },
  "metadata": {
    "source_lab": "partner_lab",
    "integration_version": "pilot-v1",
    "profile": {
      "age": 38,
      "sex": "female"
    }
  },
  "idempotency_key": "partner-order-abc-001"
}
```

Notes:

- `external_user_id` is partner-scoped.
- `partner_id` is ignored if present in metadata and is always resolved from the API key.
- MVP accepts parsed JSON biomarkers only. PDF/file ingestion is intentionally not part of this endpoint yet.
- Supported common units include `ng/mL`, `ug/L`, `mg/dL`, `mmol/L`, `g/dL`, `U/L`, `IU/L`, `uIU/mL`, `%`, `pg/mL`, and `nmol/L`.
- Raw request storage is minimized for the pilot. VITALOOP stores biomarkers and safe integration metadata, but avoids persisting arbitrary profile/metadata fields in `raw_payload`.
- Partner-specific biomarker mappings can be configured in `partners.b2b_biomarker_mappings`, for example `{ "Ferritin Serum": "ferritin" }`. Built-in default aliases still apply.
- Optional partner IP allowlist can be configured in `partners.b2b_allowed_ips`, for example `[ "203.0.113.10", "198.51.100.0/24" ]`. When Cloudflare is required, VITALOOP evaluates the partner IP from `CF-Connecting-IP`.

## Response

```json
{
  "analysis_id": "1f7f2cb9-4d5a-40e7-8a9b-d5e3d8acaa73",
  "status": "completed",
  "health_summary": {
    "headline": "2 biomarkers found. 1 need review, 1 are currently in range.",
    "risk_level": "needs_attention",
    "confidence": 0.82,
    "requires_doctor": false,
    "disclaimer": "This report is educational and is not a diagnosis. Discuss abnormal or concerning results with a qualified clinician.",
    "what_was_found": {
      "counts": {
        "total": 2,
        "optimal": 1,
        "borderline": 0,
        "deficient": 1,
        "elevated": 0
      }
    }
  },
  "prioritized_biomarkers": [
    {
      "name": "Ferritin",
      "canonical_name": "canonical_ferritin",
      "value": 12,
      "unit": "ng/mL",
      "status": "DEFICIENT",
      "category": "nutrients",
      "priority": "high",
      "rationale": "Prioritized because the value is outside or near the provided reference range.",
      "reference_range": "30-150"
    }
  ],
  "risks_flags": [
    {
      "type": "biomarker_flag",
      "severity": "high",
      "title": "Ferritin is deficient",
      "rationale": "Prioritized because the value is outside or near the provided reference range.",
      "biomarker": "canonical_ferritin",
      "requires_doctor": true
    }
  ],
  "recommendations": [],
  "protocol": {
    "nutrition": [],
    "supplements": [],
    "lifestyle": [],
    "training_recovery": []
  },
  "retest_suggestions": [
    {
      "marker": "Ferritin",
      "timing": "8-12 weeks",
      "reason": "Ferritin is deficient and should be trended after intervention or clinical review.",
      "priority": "high"
    }
  ],
  "doctor_summary": "Review Ferritin in the context of symptoms, medications, and recent diet/training.",
  "knowledge_evaluation": {
    "matched_rules": []
  },
  "disclaimer": "This analysis is educational decision support and is not a diagnosis. Discuss abnormal, urgent, or concerning results with a qualified clinician.",
  "metadata": {
    "partner_id": "resolved-from-api-key",
    "external_user_id": "partner-user-123",
    "request_hash": "sha256",
    "idempotency_key": "partner-order-abc-001",
    "retention_days": 90,
    "api_version": "v1",
    "key_prefix": "vlp_live_ab12"
  }
}
```

## Error Codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 401 | Missing partner API key | `X-Partner-Api-Key` is missing. |
| 401 | Invalid partner API key | Key hash was not found or is inactive. |
| 401 | Expired partner API key | Key exists but expired. |
| 403 | Missing required scope: labs:analyze | Key does not have the required scope. |
| 403 | CLOUDFLARE_REQUIRED | Partner is configured to require Cloudflare edge traffic. |
| 403 | IP_NOT_ALLOWED | Client IP is not in the partner allowlist. |
| 422 | INVALID_BIOMARKER_UNIT | Biomarker unit is unsupported for B2B MVP. |
| 429 | RATE_LIMITED | Partner or API key exceeded configured request limits. |
| 409 | IDEMPOTENT_REQUEST_IN_PROGRESS | Duplicate request exists but the first response has not been stored yet. Retry with the same idempotency key. |
| 503 | RATE_LIMITER_UNAVAILABLE | Redis rate limiter is required but not configured. |
| 500 | B2B_ANALYSIS_CREATE_FAILED | VITALOOP could not create the analysis record. |

## Integration Flow

1. VITALOOP provisions partner row and API key with `labs:analyze`.
2. Partner sends parsed biomarker JSON to `/v1/b2b/analyze-labs`.
3. VITALOOP resolves tenant from `X-Partner-Api-Key`.
4. VITALOOP enforces Cloudflare/IP policy if configured for the partner.
5. VITALOOP applies Redis-backed per-partner and per-key rate limits.
6. VITALOOP checks idempotency using partner, external user, idempotency key, and request hash.
7. VITALOOP stores a minimized raw request in partner tables.
8. VITALOOP normalizes biomarker names and units.
9. VITALOOP runs the shared lab analysis pipeline with knowledge/rules evaluation, safety flags, AI protocol generation, retest suggestions, and doctor summary.
10. VITALOOP stores normalized biomarkers, final response, status, and usage metadata.
11. VITALOOP returns the structured JSON response.

## Audit Events

The B2B endpoint writes best-effort audit events:

- `request_accepted`
- `request_replayed`
- `request_completed`
- `request_failed`
- `request_rate_limited`
- `api_key_used`

Audit payloads include `partner_id`, `api_key_id`, request hash, and analysis id when available. PHI should not be placed in audit logs.

## Idempotency

VITALOOP scopes idempotency by partner, idempotency key, and request hash. If a duplicate completed request is received, VITALOOP returns the stored response with `metadata.idempotent_replay=true`.

If the duplicate arrives while the first request is still processing and no stored response exists yet, the endpoint returns `409 IDEMPOTENT_REQUEST_IN_PROGRESS`. The partner should retry using the same `X-Idempotency-Key`.

## Usage And Cost Tracking

For the pilot, VITALOOP stores usage in `partner_usage_events`:

- request count
- biomarker count
- prompt token estimate
- completion token estimate
- estimated USD cost
- `estimated=true`

The shared LLM service may also persist exact provider usage when the model response includes usage fields. B2B cost metadata is marked estimated unless exact per-call usage is plumbed into the endpoint response.

## API Key Rotation

Partners may have multiple active API keys. Rotation process:

1. Create a new `partner_api_keys` row with `status=active`, `labs:analyze` scope, and a non-secret `key_prefix`.
2. Partner deploys the new key.
3. Monitor `last_used_at` and `api_key_used` audit events for both old and new key.
4. Revoke the old key by setting `status=revoked` and `revoked_at=now()`.

Revocation is immediate because every request resolves the key hash against active keys.

## Monitoring

Sentry should be configured with `SENTRY_DSN` for exception tracing.

Prometheus-compatible metrics are exposed at:

```http
GET /metrics
Authorization: Bearer <METRICS_BEARER_TOKEN>
```

Set `METRICS_BEARER_TOKEN` before exposing `/metrics` outside a private network.

Current B2B metrics include:

- `vitaloop_b2b_requests_total`
- `vitaloop_b2b_request_latency_seconds_bucket`

Recommended Grafana alerts:

- high `request_failed` count
- high `rate_limited` count
- Redis limiter unavailable
- B2B latency p95/p99 regression
- cost anomaly per partner
- elevated 401/403 on `/v1/b2b/*`

## PHI/GDPR Pilot Controls

- `partners.b2b_retention_days` controls pilot retention metadata. Default: 90 days.
- Raw payload storage is minimized and excludes arbitrary metadata/profile fields.
- Export plan: export by `partner_id + external_user_id` from `partner_patients`, `partner_lab_results`, `partner_biomarkers`, `partner_insights`, and `partner_usage_events`.
- Delete plan: delete the `partner_patients` row for `partner_id + external_user_id`; dependent partner lab results, biomarkers, insights, and embedded sessions cascade where foreign keys are configured. Usage events with nullable lab references may need explicit deletion/anonymization by `partner_id` and request metadata.
- Before public launch, add an operator-run delete/export command or admin endpoint with audit logging and partner approval workflow.

## Current MVP Boundaries

- JSON biomarkers only.
- No PDF/file upload in this endpoint.
- Cost metadata is estimated in the B2B response storage unless exact provider usage is available from the underlying LLM service.
- Response schema should be versioned before public partner launch.
