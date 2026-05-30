# Partner Layer Staging Validation Log

Use this log after each controlled Stage 6-7 run.

## Entry Template
- Date/time:
- Environment: staging
- STAGING_API_URL:
- Migration applied (`stage-17-partner-integration-mvp.sql`):
- Seed executed (`seed_partner_smartlab.py`):
- Smoke executed (`smoke_partner_http_flow.py`):
- Tables verified:
  - partners:
  - partner_api_keys:
  - partner_patients:
  - partner_lab_results:
  - partner_biomarkers:
  - partner_insights:
  - partner_events:
  - partner_embedded_sessions:
- Outcome: pass/fail
- Notes:

## 2026-05-29 Attempt 1 (Post-migration)
- Date/time: 2026-05-29
- Environment: staging
- STAGING_API_URL: configured (`staging-api.vitaloop.today`)
- Migration applied (`stage-17-partner-integration-mvp.sql`): user-reported success
- Seed executed (`seed_partner_smartlab.py`): failed
- Smoke executed (`smoke_partner_http_flow.py`): failed
- Tables verified:
  - partners: not verified in this run
  - partner_api_keys: not verified in this run
  - partner_patients: not verified in this run
  - partner_lab_results: not verified in this run
  - partner_biomarkers: not verified in this run
  - partner_insights: not verified in this run
  - partner_events: not verified in this run
  - partner_embedded_sessions: not verified in this run
- Outcome: fail
- Notes:
  - Readiness check shows placeholders/missing real values for `SMARTLAB_PARTNER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  - Seed error: `RuntimeError: Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`
  - Smoke error: `httpx.ConnectError: [Errno 8] nodename nor servname provided, or not known` when calling staging API host.

## 2026-05-30 Attempt 2 (Credentials fixed)
- Date/time: 2026-05-30
- Environment: staging
- STAGING_API_URL: `https://staging-api.vitaloop.today`
- Migration applied (`stage-17-partner-integration-mvp.sql`): user-reported success (already applied before this attempt)
- Seed executed (`seed_partner_smartlab.py`): success
- Smoke executed (`smoke_partner_http_flow.py`): failed
- Tables verified:
  - partners: seeded (partner_id returned)
  - partner_api_keys: seeded (partner_api_key_id/hash/scopes returned)
  - partner_patients: seeded (fixture_partner_patient_id returned)
  - partner_lab_results: seeded (fixture_partner_lab_result_id returned)
  - partner_biomarkers: not verified in this run
  - partner_insights: not verified in this run
  - partner_events: not verified in this run
  - partner_embedded_sessions: not verified in this run
- Outcome: fail
- Notes:
  - Readiness checks passed for all required env values (`STAGING_DATABASE_URL`, `STAGING_API_URL`, `SMARTLAB_PARTNER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
  - Seed output returned IDs and expected scopes for Smartlab partner.
  - Smoke failed before HTTP-level validation due DNS resolution issue:
    - `nslookup staging-api.vitaloop.today` -> `NXDOMAIN`
    - `curl https://staging-api.vitaloop.today/health` -> `Could not resolve host`
  - Next action: create/propagate DNS record for staging API host (or set `STAGING_API_URL` to reachable staging host), then rerun smoke only.

## 2026-05-30 Attempt 3 (DNS recheck)
- Date/time: 2026-05-30
- Environment: staging
- STAGING_API_URL: `https://staging-api.vitaloop.today`
- Migration applied (`stage-17-partner-integration-mvp.sql`): already applied
- Seed executed (`seed_partner_smartlab.py`): already successful in Attempt 2
- Smoke executed (`smoke_partner_http_flow.py`): failed again
- Tables verified:
  - partners: already seeded in Attempt 2
  - partner_api_keys: already seeded in Attempt 2
  - partner_patients: already seeded in Attempt 2
  - partner_lab_results: already seeded in Attempt 2
  - partner_biomarkers: not verified in this run
  - partner_insights: not verified in this run
  - partner_events: not verified in this run
  - partner_embedded_sessions: not verified in this run
- Outcome: fail
- Notes:
  - DNS check result: `nslookup staging-api.vitaloop.today` -> `NXDOMAIN`.
  - Health probe result: `curl -i $STAGING_API_URL/health` -> `Could not resolve host`.
  - Smoke failure remains infrastructure-level DNS resolution blocker.

## 2026-05-30 Attempt 4 (Local API + staging DB quick Stage 7)
- Date/time: 2026-05-30
- Environment: local API (`http://127.0.0.1:8000`) + staging Supabase/Postgres
- STAGING_API_URL: overridden for smoke as `http://127.0.0.1:8000`
- Migration applied (`stage-17-partner-integration-mvp.sql`): already applied
- Seed executed (`seed_partner_smartlab.py`): already successful
- Smoke executed (`smoke_partner_http_flow.py`): success
- Tables verified:
  - partners: seeded
  - partner_api_keys: seeded
  - partner_patients: seeded
  - partner_lab_results: created by smoke
  - partner_biomarkers: created by smoke
  - partner_insights: created by smoke
  - partner_events: created by smoke
  - partner_embedded_sessions: created by smoke
- Outcome: pass
- Notes:
  - Full flow passed: ingest -> insights -> embedded session -> embedded view -> partner event -> embedded event.
  - Fix validated for embedded patient reference handling (non-UUID external patient IDs no longer trigger UUID cast failure).
