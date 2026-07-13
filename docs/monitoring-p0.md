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

## SLO Baseline

| Area | Target |
| --- | --- |
| API health availability | 99.5% during pilot |
| API health latency | p95 < 3s |
| B2B analyze latency | p95 < 30s during controlled pilot |
| B2B failure spike | < 3 failures / 15 min |
| Rate limit spike | Investigate at >= 10 limited requests / 15 min |

## Operational Notes

- Sentry is the primary exception trail.
- Grafana is the primary live dashboard.
- Prometheus alerts are the first alerting layer.
- `scripts/collect-slo-metrics.sh` remains useful for manual server-side snapshots.
- Full endpoint-level B2C latency metrics should be added after P0 via ASGI middleware or OpenTelemetry.
