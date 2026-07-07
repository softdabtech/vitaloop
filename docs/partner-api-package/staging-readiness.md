# B2B API Staging Readiness Checklist

Use this checklist before giving a partner a staging API key.

## Code

- [ ] `docs/openapi/b2b-api.yaml` is current.
- [ ] OpenAPI validates.
- [ ] Backend tests pass.
- [ ] B2B endpoint is available at `/v1/b2b/analyze-labs`.

## Database

- [ ] Apply `backend/sql/stage-24-b2b-analyze-labs.sql`.
- [ ] Confirm `partners.b2b_retention_days` exists.
- [ ] Confirm `partners.b2b_biomarker_mappings` exists.
- [ ] Confirm `partners.b2b_allowed_ips` exists.
- [ ] Confirm `partners.b2b_require_cloudflare` exists.
- [ ] Confirm `partner_usage_events` exists.

## Redis Rate Limit

- [ ] Configure `RATE_LIMIT_REDIS_URL`.
- [ ] Confirm Redis is reachable from backend.
- [ ] Confirm B2B requests fail with `503 RATE_LIMITER_UNAVAILABLE` if Redis is missing in production-like env.
- [ ] Confirm repeated requests can produce `429 RATE_LIMITED` with low test limits.

## Cloudflare

- [ ] Route `/v1/b2b/*` through Cloudflare.
- [ ] Add WAF rules for bots/scanners.
- [ ] Add request size limit.
- [ ] Add optional partner IP allowlist at Cloudflare edge.
- [ ] If partner requires Cloudflare, set `b2b_require_cloudflare=true`.

## Partner Key

- [ ] Create partner row.
- [ ] Create active API key with `labs:analyze`.
- [ ] Store only key hash in DB.
- [ ] Set non-secret `key_prefix`.
- [ ] Send raw key to partner through secure channel only.
- [ ] Confirm `last_used_at` updates after a request.

## Smoke Tests

- [ ] valid key
- [ ] invalid key
- [ ] idempotency replay
- [ ] wrong unit
- [ ] rate limit
- [ ] `/v1/b2b/analyze-labs` path

## Monitoring

- [ ] `SENTRY_DSN` configured.
- [ ] `/metrics` protected by `METRICS_BEARER_TOKEN` or private network only.
- [ ] Grafana/Prometheus scrape configured.
- [ ] Alerts configured for failures, 429 spikes, Redis unavailable, cost anomaly, latency regression.
