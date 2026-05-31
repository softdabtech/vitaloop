# Smartlab Sandbox Quickstart

## What Is Sandbox
Sandbox is an isolated integration environment for validating the Smartlab to VITALOOP partner flow end-to-end. It is intended for API contract validation, payload compatibility checks, and demo rehearsals. It is not intended for production traffic or real patient operations.

## Base URL
- `https://staging-api.vitaloop.today`

## Authentication
All partner endpoints require the HTTP header:
- `X-Partner-Api-Key: {{partner_api_key}}`

## Sandbox Test Flow
1. Send lab result payload to partner ingest endpoint.
2. Read generated insight by `partner_lab_result_id`.
3. Create embedded session for the same lab result.
4. Open embedded view by embedded token.
5. Track partner event to confirm analytics/event contract.

## Required From Smartlab
- Test API client (Postman or service client).
- Stable sandbox payload format (order IDs, result IDs, biomarker set).
- Non-production identifiers for `external_patient_id`, `external_order_id`, `external_result_id`.
- One technical owner for error triage and payload mapping decisions.

## Provided By VITALOOP
- Staging API host and partner endpoints.
- Partner API key for sandbox (shared via secure channel).
- Canonical biomarker normalization and insight generation.
- Embedded session flow for demo UI handoff.
- Troubleshooting support during pilot onboarding.

## Sandbox Limitations
- No production SLA guarantees.
- Data may be reset during staging maintenance.
- Non-production only; do not send real personal data.
- API contracts may evolve during pilot phase with versioned notice.
- Access may be temporarily rate-limited during testing windows.

## Minimal Endpoint Map
- `GET /health`
- `POST /partners/v1/results`
- `GET /partners/v1/insights/{partner_lab_result_id}`
- `POST /partners/v1/embedded/sessions`
- `GET /partners/v1/embedded/{embedded_token}`
- `POST /partners/v1/events`
