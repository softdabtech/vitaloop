# Smartlab Pilot API Contract (MVP)

## Auth
Header:
- `X-Partner-Api-Key: <raw_partner_key>`

Required scopes:
- `results:write` for ingest
- `results:read` for insight fetch
- `embedded:create` for embedded session creation
- `events:write` for partner event ingestion

## Endpoint
`POST /partners/v1/results`

### Request
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

### Response
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

## Retrieve insight
`GET /partners/v1/results/{partner_lab_result_id}/insights`

## Embedded session
- Create: `POST /partners/v1/embedded-sessions`
- Consume: `GET /partners/embed/{token}`
- Token behavior: short-lived multi-use session token (valid until expiry)

## Events
- Unknown `event_type` values are rejected with `422`.
