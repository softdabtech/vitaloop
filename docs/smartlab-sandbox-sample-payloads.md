# Smartlab Sandbox Sample Payloads

All samples below are synthetic and contain no real personal data.

## 1) Ingest Lab Result (Request)
Endpoint:
- `POST /partners/v1/results`

Headers:
- `Content-Type: application/json`
- `X-Partner-Api-Key: {{partner_api_key}}`

```json
{
  "external_patient_id": "sandbox-patient-001",
  "external_order_id": "sandbox-order-1001",
  "external_result_id": "sandbox-result-9001",
  "source_lab": "smartlab",
  "result_date": "2026-05-31",
  "biomarkers": [
    {
      "name": "Hemoglobin",
      "value": 13.4,
      "unit": "g/dL",
      "ref_low": 12.0,
      "ref_high": 16.0
    },
    {
      "name": "Ferritin",
      "value": 40,
      "unit": "ng/mL",
      "ref_low": 15,
      "ref_high": 150
    }
  ],
  "metadata": {
    "source": "sandbox",
    "channel": "demo"
  }
}
```

Example response:

```json
{
  "status": "processed",
  "partner_lab_result_id": "11111111-2222-3333-4444-555555555555",
  "duplicate": false
}
```

## 2) Get Insight (Response Example)
Endpoint:
- `GET /partners/v1/insights/{partner_lab_result_id}`

```json
{
  "partner_lab_result_id": "11111111-2222-3333-4444-555555555555",
  "health_score": 78,
  "risk_flags": [
    "low_ferritin_trend"
  ],
  "recommendations": [
    {
      "code": "retest_ferritin",
      "title": "Repeat ferritin test in follow-up window"
    }
  ],
  "generated_at": "2026-05-31T14:00:00Z"
}
```

## 3) Create Embedded Session
Endpoint:
- `POST /partners/v1/embedded/sessions`

Request:

```json
{
  "partner_lab_result_id": "11111111-2222-3333-4444-555555555555",
  "external_patient_id": "sandbox-patient-001"
}
```

Response:

```json
{
  "embedded_token": "sandbox_token_placeholder",
  "expires_at": "2026-05-31T15:00:00Z",
  "policy": "multi_use_short_session"
}
```

Embedded view open:
- `GET /partners/v1/embedded/{embedded_token}`

## 4) Track Partner Event
Endpoint:
- `POST /partners/v1/events`

```json
{
  "event_type": "partner.insight_viewed",
  "partner_lab_result_id": "11111111-2222-3333-4444-555555555555",
  "external_patient_id": "sandbox-patient-001",
  "event_payload": {
    "surface": "sandbox_demo",
    "source": "smartlab_portal"
  }
}
```

Example response:

```json
{
  "ok": true,
  "event_id": "66666666-7777-8888-9999-000000000000"
}
```
