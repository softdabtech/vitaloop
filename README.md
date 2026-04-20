# VITALOOP

Production URLs:

- Frontend: https://vitaloop.today
- API: https://api.vitaloop.today
- CRM: https://crm.vitaloop.today

VITALOOP is a health platform for lab report interpretation, personalized protocol generation, longitudinal biomarker tracking, weekly check-ins, and practitioner/admin operations.

## Architecture

The production system has three main runtime components:

1. `frontend/`
   - React 18 + Vite 5 app
   - Public marketing site and user-facing flows
   - Supabase client auth
   - CRM token handoff through `POST /auth/post-login`

2. `backend/`
   - FastAPI service for analysis, protocol, progress, timeline, check-ins, questionnaires, admin data, and health endpoints
   - Supabase-backed auth and data access
   - Security headers and path-based rate limiting

3. `crm-mvc/`
   - ASP.NET 8 MVC CRM/admin/ops application
   - Validates Supabase JWTs via JWKS
   - Resolves normalized user context through backend `/auth/me`
   - Exposes public `GET /version` for deploy verification

Infrastructure and ops assets:

- `scripts/`
- `docs/`
- `ops/`
- `nginx.vitaloop.conf`
- `docker-compose.yml`
- `supabase_migrations.sql`

## Repository Layout

```text
.
├── backend/
├── crm-mvc/
├── frontend/
├── docs/
├── ops/
├── scripts/
├── nginx.vitaloop.conf
├── supabase_migrations.sql
├── docker-compose.yml
└── README.md
```

## Stack

- Frontend: React 18, Vite 5, Tailwind, Framer Motion, Supabase JS
- Backend: FastAPI, Python 3.12, Pydantic settings
- CRM: ASP.NET 8 MVC
- Database/Auth: Supabase Postgres + Supabase Auth
- Operations: nginx, systemd, shell deployment tooling

## Local Development

### Prerequisites

- Node 20
- Python 3.12
- .NET 8 SDK

### Environment

Create local env/config files using your team-managed values.

Typical minimum configuration:

- Frontend
  - `VITE_API_BASE_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Backend
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - auth/JWKS settings
  - `ALLOWED_ORIGINS`
  - rate-limit settings
  - security header settings
  - retention settings
  - optional LLM, email, Stripe, and Sentry keys
- CRM
  - `Auth` settings
  - `CrmData` settings
  - backend base URL

### Run Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8004
```

### Run Frontend

```bash
cd frontend
npm install
npm run dev
```

### Run CRM

```bash
cd crm-mvc
dotnet restore
dotnet run --project Vitaloop.Crm.Web.csproj
```

## Auth Flow

1. User signs in on the frontend through Supabase.
2. Frontend decides whether the user stays in the end-user app or is handed off to CRM.
3. For CRM access, frontend submits the access token to `POST /auth/post-login`.
4. CRM stores `vo_access_token` in a cookie.
5. CRM validates the ES256 token using Supabase JWKS.
6. CRM calls backend `/auth/me` to resolve user and role context.
7. User is redirected to the correct CRM destination such as `/ops` or `/admin`.

Runtime note:

- Production API paths are root paths such as `/auth/me`, `/progress`, `/insights`, and `/questionnaires` on `api.vitaloop.today`.
- Do not assume a `/api/*` prefix exists in production.

## Health and Version Endpoints

API:

- `GET https://api.vitaloop.today/health`
- `GET https://api.vitaloop.today/health/ready`
- `GET https://api.vitaloop.today/health/detailed`

Frontend:

- `GET https://vitaloop.today/build-info.json`

CRM:

- `GET https://crm.vitaloop.today/version`

`build-info.json` is intentionally excluded from service-worker precache and served with `no-cache` headers so deploy verification always reads the current frontend artifact.

## Deployment

Deploy from `main` and run deployment commands from the repository root.

### Standard Production Deploy

```bash
export REMOTE_HOST="deploy@your-prod-host"
export REMOTE_DIR="/var/www/VITALOOP"

git add .
git commit -m "feat/fix: ..."
git push origin main

./scripts/deploy-prod.sh
```

Useful variants:

```bash
./scripts/deploy-prod.sh --force
./scripts/deploy-prod.sh --no-backup
RUN_RATE_LIMIT_SMOKE=1 ./scripts/deploy-prod.sh
```

What `scripts/deploy-prod.sh` does now:

1. Runs local pre-deploy checks.
2. Pushes `main` to GitHub.
3. Creates a backup branch on the server.
4. Fast-forwards the server checkout to `origin/main`.
5. Builds the frontend locally with `npm run build:prod` and syncs `frontend/dist/` to the server.
6. Builds CRM on the server only when `crm-mvc/` changed.
7. Restarts only the services that need restarting.
8. Syncs `nginx.vitaloop.conf` to both `sites-available/vitaloop.today` and `sites-enabled/vitaloop.today` when nginx changed.
9. Validates API health, readiness, security headers, frontend build commit, CRM health, and CRM `/version`.

### Pre-Deploy Check Only

```bash
./scripts/pre-deploy-check.sh
```

### Staging to Production

```bash
git checkout staging
git pull origin staging
git push origin staging

./scripts/promote-staging-to-prod.sh staging
./scripts/deploy-prod.sh
```

### Rollback

Preview rollback targets:

```bash
export REMOTE_HOST="deploy@your-prod-host"
./scripts/rollback.sh
```

Rollback to a specific commit:

```bash
export REMOTE_HOST="deploy@your-prod-host"
./scripts/rollback.sh abc1234 --confirm
```

Rollback rebuilds frontend and CRM, restarts services, and validates API/frontend availability after the server checkout changes.

## Operational Checks

After deploy, verify:

1. `curl https://api.vitaloop.today/health`
2. `curl https://api.vitaloop.today/health/ready`
3. `curl https://vitaloop.today/build-info.json`
4. `curl https://crm.vitaloop.today/version`
5. `./scripts/smoke_api_security_headers.sh`
6. Optional: `./scripts/smoke_rate_limiter.sh`

Collect SLO metrics:

```bash
./scripts/collect-slo-metrics.sh
```

Frontend QA helpers:

```bash
cd frontend
npm run qa
```

## Security and Retention Utilities

API security header smoke:

```bash
./scripts/smoke_api_security_headers.sh
```

Rate limiter smoke:

```bash
./scripts/smoke_rate_limiter.sh
```

Install retention timer:

```bash
export REMOTE_HOST="deploy@your-prod-host"
export REMOTE_DIR="/var/www/VITALOOP"
./scripts/install_retention_timer.sh
```

Run retention redaction manually on the backend host:

```bash
cd /var/www/VITALOOP/backend
./.venv/bin/python scripts/run_lab_retention_redaction.py --days 180 --batch-size 500 --apply
```

## Documentation

Key docs in this repository:

- `DEPLOYMENT_RUNBOOK.md`
- `DIAGNOSTICS.md`
- `OPERATIONAL_MANUAL.md`
- `DEBUG_AUTH_FLOW.md`
- `EMAIL_FIX_GUIDE.md`
- `docs/architecture-target-2026-execution.md`
- `docs/aspnet-migration-step-1-audit-blueprint.md`
- `docs/aspnet-migration-step-2-foundation.md`

## Notes

- CRM token validation should remain Supabase ES256/JWKS-based. Do not force HS256 secret-based production validation.
- CRM/admin access depends on backend `/auth/me` user context, not only raw frontend auth state.
- Frontend pricing copy should stay aligned with `frontend/src/lib/pricing.js`.
- For frontend deploy validation, check `build-info.json`, not only the HTML shell.