# Partner Layer Staging Runbook

## Safety rule
Run only against staging database.
Do not run these commands against production.

## 0) Prepare local staging env
Create local env file (do not commit secrets):

```bash
cp backend/.env.staging.local.example backend/.env.staging.local
```

Set values in `backend/.env.staging.local`:
- `STAGING_DATABASE_URL`
- `STAGING_API_URL`
- `SMARTLAB_PARTNER_API_KEY`
- `SUPABASE_URL` (staging project)
- `SUPABASE_SERVICE_ROLE_KEY` (staging service role)

Load env in shell:

```bash
set -a
source backend/.env.staging.local
set +a
```

Optional safety check:

```bash
echo "$STAGING_API_URL"
```

Ensure this is staging endpoint before continuing.

## 1) Apply schema migration (staging)
Prerequisites:
- `psql` installed
- `STAGING_DATABASE_URL` exported

If `psql` is unavailable, run `backend/sql/stage-17-partner-integration-mvp.sql`
manually in Supabase SQL Editor for staging project.

Command:
```bash
cd /Users/oleksii/projects/vitaloop
STAGING_DATABASE_URL="$STAGING_DATABASE_URL" bash backend/scripts/apply_partner_migration_staging.sh
```

## 2) Seed Smartlab partner + API key hash (+ optional fixtures)
Prerequisites:
- `SMARTLAB_PARTNER_API_KEY` must be real (not placeholder)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must target staging

Option A: provide your own API key
```bash
cd /Users/oleksii/projects/vitaloop
PYTHONPATH=/Users/oleksii/projects/vitaloop/backend \
/usr/local/bin/python3 backend/scripts/seed_partner_smartlab.py \
  --api-key "smartlab_staging_key" \
  --with-fixtures
```

Option B: generate API key automatically
```bash
cd /Users/oleksii/projects/vitaloop
PYTHONPATH=/Users/oleksii/projects/vitaloop/backend \
/usr/local/bin/python3 backend/scripts/seed_partner_smartlab.py \
  --generate-api-key \
  --with-fixtures
```

Outputs include:
- partner_id
- partner_api_key_id
- partner_api_key_hash
- partner_api_key_plain
- fixture_partner_patient_id
- fixture_partner_lab_result_id

If service-role env is unavailable, use SQL Editor fallback:
- execute [backend/sql/stage-17-smartlab-staging-seed.sql](backend/sql/stage-17-smartlab-staging-seed.sql) in staging
- replace `__REPLACE_WITH_SHA256_API_KEY_HASH__` with SHA-256 hash of `SMARTLAB_PARTNER_API_KEY`

## 3) Run full HTTP smoke flow
Required env:
- `STAGING_API_URL`
- `SMARTLAB_PARTNER_API_KEY`

Command:
```bash
cd /Users/oleksii/projects/vitaloop
PARTNER_SMOKE_BASE_URL="$STAGING_API_URL" \
PARTNER_SMOKE_API_KEY="$SMARTLAB_PARTNER_API_KEY" \
/usr/local/bin/python3 backend/scripts/smoke_partner_http_flow.py
```

Expected checks:
- ingest endpoint accepts payload
- insight endpoint returns payload
- embedded session created
- embedded endpoint returns insight data
- partner and embedded events accepted

## 4) Verify staging tables
Run checks in staging SQL editor (or psql):
- `partners`
- `partner_api_keys`
- `partner_patients`
- `partner_lab_results`
- `partner_biomarkers`
- `partner_insights`
- `partner_events`
- `partner_embedded_sessions`

## 5) Record controlled validation result
Append outcome to this runbook after smoke:
- date/time
- staging API URL
- migration status
- seed status
- smoke status
- table verification status
- blocker notes (if any)
