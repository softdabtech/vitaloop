# VITALOOP

Production URLs:

- Frontend: https://vitaloop.today
- API: https://api.vitaloop.today
- CRM: https://crm.vitaloop.today

VITALOOP is a health platform for lab report interpretation, personalized protocol generation, longitudinal biomarker tracking, weekly check-ins, and practitioner/admin operations.

## Product Intention

VITALOOP is not meant to be a generic health SaaS shell.

- Core value is the loop: lab interpretation, personalized protocoling, longitudinal tracking, questionnaire inputs, and adaptive follow-up.
- CRM is not a separate product line; it is the operational layer that supports access control, practitioner workflows, admin tooling, and organization context around the same core product.
- Questionnaire, persona, and adaptation flows are part of the main product thesis, not optional add-ons.
- Product decisions should preserve a closed loop from data intake to action to re-check, rather than optimizing only for acquisition or presentation.

## Current Priorities

- Auth stability across frontend, backend, and CRM
- Canonical role resolution and predictable access control
- CRM route access without auth loops or stale cookies
- Onboarding completion and end-user routing correctness
- Questionnaire and adaptive follow-up flows tied back to protocol and tracking

Not current focus:

- Investor-style surface polish without backend proof
- Broad marketing expansion that outruns product truth
- Splitting CRM into a standalone product concept

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

## Module Map

| Module | Primary owner surface | Current status | Dependency risk | Recent focus |
| --- | --- | --- | --- | --- |
| `frontend/` | Product UI and auth-routing layer | Active | Medium: depends on backend route compatibility and Supabase session state | Landing updates, auth flow hardening, build-info deploy validation |
| `backend/` | Canonical business logic and access-context layer | Active | High: role resolution, auth context, protocol/check-in/questionnaire continuity | `/auth/me` role normalization, compatibility routes, health build metadata |
| `crm-mvc/` | Admin, ops, practitioner workflow layer | Active | High: depends on backend `/auth/me` and token handoff correctness | `POST /auth/post-login`, logout cleanup, `/version`, safer CRM access flow |
| `scripts/` | Delivery and operational safety layer | Active | Medium: deploy correctness directly affects runtime trust | local frontend build + artifact sync, nginx sync, pre-deploy hardening |
| `nginx.vitaloop.conf` | Edge routing and cache-control layer | Active | High: wrong config can break routing or stale asset verification | `vitaloop.today` alignment, `build-info.json` no-cache behavior |

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

LLM provider (internal AI, OpenAI-compatible) example:

- `ROUTELLM_BASE_URL=http://127.0.0.1:11434/v1`
- `ROUTELLM_API_KEY=<local-or-provider-key>`
- `ROUTELLM_MODEL=qwen2.5:0.5b`

Notes:

- Backend expects an OpenAI-compatible API.
- For local self-hosted runtime, Ollama is supported out of the box.
- Monitor LLM separately with `GET /ops/llm/health` (in addition to `/health` and `/health/ready`).

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

## Roles and Access Source of Truth

Canonical role resolution lives in the backend.

- Canonical role constants are defined in `backend/app/constants.py` as `CRM_ROLES`.
- Canonical normalization logic lives in `backend/app/utils/roles.py`.
- Effective user context is resolved by backend `/auth/me`.
- CRM should trust backend-resolved context for access decisions and route outcomes.
- Frontend may only use auth/session state for UX routing hints, not as the final authority for privileged access.

Current role vocabulary includes:

- `end_user`
- `super_admin`
- `admin`
- `org_admin`
- `org_owner`
- `client_admin`
- `manager`
- `practitioner`

Responsibility split:

- Frontend:
  - starts sign-in flows
  - handles end-user UX routing
  - initiates CRM token handoff
  - must not be treated as the source of truth for admin or CRM authorization
- Backend:
  - normalizes role values from account data and token metadata
  - resolves final user context and onboarding state
  - decides the canonical effective role exposed to other layers
- CRM:
  - validates Supabase token authenticity
  - consumes backend user context
  - enforces CRM/admin route access using backend-resolved context, not frontend assumptions

Do not let privileged access rules drift into frontend-only checks. If a role or access rule matters for data access, CRM access, or admin visibility, the decision belongs in backend context resolution and server-side enforcement.

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

# One-command post-deploy smoke (health + PDF + image + non-empty biomarkers)
./scripts/post_deploy_smoke.sh
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