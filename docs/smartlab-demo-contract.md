# Smartlab Demo Contract Package

## 1) API Contract
Base endpoints:
- `POST /partners/v1/results`
- `GET /partners/v1/results/{partner_lab_result_id}/insights`
- `POST /partners/v1/embedded-sessions`
- `GET /partners/embed/{token}`
- `POST /partners/v1/events`
- `POST /partners/v1/embedded/events`

Auth:
- Server-to-server endpoints use `X-Partner-Api-Key`.
- Required scopes by endpoint:
  - `results:write`
  - `results:read`
  - `embedded:create`
  - `events:write`

Validation rules:
- Unknown `event_type` -> `422`.
- `partner_slug` in payload must match API-key owner.
- Duplicate `(partner_id, external_order_id, external_result_id)` is idempotent and returns `status=duplicate`.

## 2) Example Payload (Smartlab -> VITALOOP)
```json
{
  "partner_slug": "smartlab",
  "external_patient_id": "PT-10045",
  "external_order_id": "ORD-333",
  "external_result_id": "RES-333",
  "lab_name": "smartlab",
  "result_date": "2026-05-19",
  "lab_result": {
    "biomarkers": [
      {"name": "Vitamin D", "value": 22.0, "unit": "ng/mL", "ref_low": 30, "ref_high": 100},
      {"name": "Glucose", "value": 98, "unit": "mg/dL", "ref_low": 70, "ref_high": 99}
    ]
  }
}
```

## 3) Example Response
```json
{
  "partner_lab_result_id": "uuid",
  "status": "processed",
  "insight_id": "uuid",
  "duplicate": false,
  "biomarkers": [
    {
      "canonical_name": "vitamin_d_25_oh",
      "display_name": "Vitamin D",
      "value": 22.0,
      "unit": "ng/mL",
      "ref_low": 30.0,
      "ref_high": 100.0,
      "status": "DEFICIENT",
      "category": "nutrients",
      "confidence": 1.0
    }
  ]
}
```

## 4) Embedded UI Flow
1. Smartlab backend calls `POST /partners/v1/embedded-sessions`.
2. VITALOOP returns short-lived embedded token.
3. Smartlab app opens embedded tab and calls `GET /partners/embed/{token}`.
4. Token policy: reusable short session until expiration.
5. Smartlab app sends user interaction events to:
   - `POST /partners/v1/embedded/events` (token-based)
   - optionally backend-side `POST /partners/v1/events` (API-key based)

## 5) Smartlab Requirements (their side)
- API access:
  - Static outbound IP allow-list (if required)
  - Secure storage/rotation of partner API key
  - Scope-based keys for staging and production
- Lab result format:
  - Stable JSON contract with biomarker name/value/unit/reference bounds
  - Unique `external_order_id` + `external_result_id` per report
  - Consistent `external_patient_id`
- Test environment:
  - Staging endpoint with non-production key
  - 3-5 real-like test panels (normal/deficient/elevated/mixed)
  - Replay dataset for idempotency checks
- Technical contacts:
  - Smartlab integration engineer
  - Smartlab backend owner
  - On-call contact for incident escalation
- Security review:
  - Key management and rotation policy
  - TLS and request logging policy
  - Data retention and PHI handling agreement
  - Pen-test/readout for public integration edge
