# VITALOOP P0 Monitoring

Date: 2026-07-13  
Architecture version: Shared Analysis Core V2

## Goal

Provide the minimum production monitoring baseline for:

- Signup and public availability QA.
- EN/UA B2C analysis and results flow.
- Controlled B2B API pilot.
- Shared Analysis Core V2 latency and failure visibility.

## Existing Backend Signals

- `GET /health`
- `GET /health/ready`
- `GET /health/detailed`
- `GET /metrics`
- Sentry exception capture via `SENTRY_DSN`
- B2B Prometheus metrics from `render_b2b_metrics()`

`/metrics` must stay protected outside private networks:

```bash
METRICS_BEARER_TOKEN=<secret>
```

## Dashboard

Grafana import file:

```text
ops/grafana/vitaloop-p0-dashboard.json
```

Expected Prometheus jobs:

```text
vitaloop_api_health
```

Required metric families:

```text
probe_success
probe_duration_seconds
vitaloop_b2b_requests_total
vitaloop_b2b_request_latency_seconds_bucket
vitaloop_analysis_cost_estimated_usd_total
vitaloop_analysis_cost_tokens_total
vitaloop_analysis_cost_prompt_tokens_total
vitaloop_analysis_cost_completion_tokens_total
```

## Alerts

Prometheus alert rules:

```text
ops/prometheus/vitaloop-p0-alerts.yml
```

Alerts included:

- `VitaloopApiUnavailable`
- `VitaloopApiHealthLatencyHigh`
- `VitaloopB2BAnalyzeFailureSpike`
- `VitaloopB2BRateLimitSpike`
- `VitaloopB2BAnalyzeLatencyP95High`
- `VitaloopAnalysisCostSpike`
- `VitaloopAnalysisTokenSpike`
- `VitaloopLlmSyntheticUnavailable`
- `VitaloopSentryDsnMissing`

## SLO Baseline

| Area | Target |
| --- | --- |
| API health availability | 99.5% during pilot |
| API health latency | p95 < 3s |
| B2B analyze latency | p95 < 30s during controlled pilot |
| B2B failure spike | < 3 failures / 15 min |
| Rate limit spike | Investigate at >= 10 limited requests / 15 min |
| AI cost | Investigate if estimated cost > $5 / 1h |
| AI tokens | Investigate if estimated/exact tokens > 1M / 1h |

## P1 Cost Analytics

The Shared Analysis Core records per-analysis cost counters into `/metrics`:

```text
vitaloop_analysis_cost_analyses_total
vitaloop_analysis_cost_tokens_total
vitaloop_analysis_cost_prompt_tokens_total
vitaloop_analysis_cost_completion_tokens_total
vitaloop_analysis_cost_estimated_usd_total
vitaloop_analysis_cost_last_analysis_estimated_usd
```

Labels:

- `source`: `results_read`, `report_regeneration`, `b2b_analyze_labs`, upload/manual sources.
- `locale`: `en`, `uk`, or `unset`.
- `model`: active LLM model.
- `estimated`: `true` when exact provider token/cost data was not available.

## P1 Report Regeneration Per Locale

Endpoint:

```http
POST /analyze/{upload_id}/regenerate
X-Vitaloop-Locale: uk
Authorization: Bearer <user-token>
```

Behavior:

- Reuses existing normalized biomarkers for the upload.
- Does not re-run PDF/OCR extraction.
- Runs Shared Analysis Core V2 with the requested locale.
- Persists a new `report_versions` row for that locale.
- Emits cost analytics with `source="report_regeneration"`.

Use this when a report was originally generated in EN but must be regenerated as UA.

## P1 Sentry/Grafana Alerts

Sentry:

- `SENTRY_DSN` should be configured in production.
- Backend captures 5xx exceptions through FastAPI/Starlette integrations.
- Sentry alerts should notify on new issue, high error count, and regression.

Grafana/Prometheus:

- Import `ops/grafana/vitaloop-p0-dashboard.json`.
- Load `ops/prometheus/vitaloop-p0-alerts.yml`.
- Configure blackbox jobs:
  - `vitaloop_api_health` -> `https://api.vitaloop.today/health`
  - `vitaloop_llm_synthetic` -> `https://api.vitaloop.today/ops/llm/synthetic-check`
  - `vitaloop_health_detailed_sentry` -> `https://api.vitaloop.today/health/detailed`, with expected Sentry status `ok` in the probe layer.

## Operational Notes

- Sentry is the primary exception trail.
- Grafana is the primary live dashboard.
- Prometheus alerts are the first alerting layer.
- `scripts/collect-slo-metrics.sh` remains useful for manual server-side snapshots.
- Full endpoint-level B2C latency metrics should be added after P0 via ASGI middleware or OpenTelemetry.
