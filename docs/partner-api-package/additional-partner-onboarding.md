# Additional B2B Partner Onboarding

Use this checklist when adding a new external platform to the VITALOOP B2B Analyze Labs API.

## Partner Profile

- Partner legal/product name.
- Technical contact and escalation contact.
- Production callback/support channel.
- Expected monthly request volume.
- Expected biomarkers per request.
- Whether the partner can provide static egress IPs.
- Required data retention period.
- Partner-specific biomarker naming examples.

## Provisioning

1. Create or confirm the active `partners` row.
2. Set `b2b_retention_days`.
3. Set `b2b_biomarker_mappings` for partner-specific names.
4. Set `b2b_allowed_ips` when static egress IPs are available.
5. Set `b2b_require_cloudflare=true` for production traffic.
6. Create a new active `partner_api_keys` row with `labs:analyze`.
7. Store only the hashed key and non-secret prefix.
8. Share the raw key through a secure channel only once.

## Required Smoke Tests

- Valid key returns a completed structured JSON response.
- Invalid key returns `401`.
- Missing `labs:analyze` scope returns `403`.
- Duplicate idempotency request returns the cached result.
- Unsupported unit returns `422 INVALID_BIOMARKER_UNIT`.
- Low test limits can produce `429 RATE_LIMITED`.
- Partner allowlist blocks an untrusted IP when configured.
- `/v1/b2b/analyze-labs` works and `/b2b/analyze-labs` is treated only as a deprecated alias.

## Public API Hardening

- Route B2B traffic through Cloudflare WAF.
- Keep Redis-backed partner and API-key rate limits enabled.
- Protect `/metrics` with `METRICS_BEARER_TOKEN` or a private network.
- Monitor request volume, error rate, p95 latency, rate-limit spikes, and cost.
- Rotate API keys by adding the new key first, validating traffic, then revoking the old key.

## Contract Limits

- Maximum 100 biomarkers per request.
- Maximum 100 symptoms per request.
- Maximum 160 characters per symptom.
- JSON biomarkers only. PDF/file upload is not included in this endpoint.
- `partner_id` must not be sent by the client; VITALOOP resolves it from the API key.

