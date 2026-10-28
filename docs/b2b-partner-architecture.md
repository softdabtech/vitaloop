# B2B Partner Integration Layer (MVP)

## Goals
- Isolate B2B intake from B2C `/analyze` routes.
- Support partner-authenticated lab result intake with idempotency.
- Normalize raw partner payloads into canonical biomarkers.
- Generate lightweight insight payload for embedded partner UI.
- Track partner/embedded events and write audit logs.

## Components
- Routers: `app/routers/partners/*`
- Partner services: `app/services/partners/*`
- Lab adapters: `app/services/lab_adapters/*`
- Canonical normalization: `app/services/lab_normalization/*`
- Insights pipeline: `app/services/intelligence/partner_pipeline.py`
- Schemas: `app/schemas/partners/*`
- SQL migration: `backend/sql/stage-17-partner-integration-mvp.sql`

## API Surface
- `POST /partners/v1/results`
- `GET /partners/v1/results/{partner_lab_result_id}/insights`
- `POST /partners/v1/embedded-sessions`
- `GET /partners/embed/{token}`
- `POST /partners/v1/events`
- `POST /partners/v1/embedded/events`

## Security Model (MVP)
- Server-to-server: `X-Partner-Api-Key` (hashed at rest).
- API key scopes are mandatory and validated per endpoint:
	- `results:write` -> `POST /partners/v1/results`
	- `results:read` -> `GET /partners/v1/results/{partner_lab_result_id}/insights`
	- `embedded:create` -> `POST /partners/v1/embedded-sessions`
	- `events:write` -> `POST /partners/v1/events`
- Embedded access: short-lived token hash in `partner_embedded_sessions`.
- Embedded token policy: `multi_use_short_session` (reusable until expiry).
- Unknown `event_type` values are rejected with `422` (no silent fallback).
- RLS: deny anon/authenticated by default; backend service role only.

## Data Flow
1. Partner sends raw result to `/partners/v1/results`.
2. API key resolves tenant (`partner_id`).
3. Idempotency check on `(partner_id, external_order_id, external_result_id)`.
4. Raw payload stored in `partner_lab_results`.
5. Smartlab adapter maps into canonical biomarkers.
6. Biomarkers saved to `partner_biomarkers`.
7. Insight payload saved to `partner_insights`.
8. Events and audit logs emitted.
