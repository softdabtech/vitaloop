# VITALOOP

Production environment:

- Frontend: https://vitaloop.today
- API (FastAPI): https://api.vitaloop.today
- CRM (ASP.NET MVC): https://crm.vitaloop.today

VITALOOP is a health platform for blood report interpretation and longitudinal tracking:

1. Upload lab report
2. Extract text/OCR
3. Analyze biomarkers
4. Generate recommendations/protocol
5. Track progress and check-ins
6. Work with CRM roles and organization context

## Architecture

The project consists of 3 main runtime components:

1. `frontend/` (React + Vite)
     - Public site, login flow, dashboard UI.
     - Sends token handoff to CRM `/auth/post-login`.

2. `backend/` (FastAPI)
     - Business API, analysis endpoints, `/auth/me` user context.
     - Supabase integration (DB + Auth token validation via JWKS ES256).

3. `crm-mvc/` (ASP.NET 8 MVC)
     - Internal CRM and admin/ops interfaces.
     - Validates Supabase JWT, resolves user context via backend `/auth/me`.

Data and infra artifacts:

- `supabase_migrations.sql`
- `docker-compose.yml`
- `nginx.vitaloop.conf`
- `scripts/`
- `docs/`

## Tech Stack

- Frontend: React, Vite
- Backend: FastAPI, Python
- CRM: ASP.NET 8 MVC
- Database/Auth: Supabase (Postgres + Auth)
- AI: LLM-based analysis pipeline

## Repository Structure

```text
.
├── backend/
├── crm-mvc/
├── frontend/
├── docs/
├── scripts/
├── supabase_migrations.sql
├── docker-compose.yml
└── README.md
```

## Local Development

### 1) Clone

```bash
git clone https://github.com/softdabtech/vitaloop.git
cd vitaloop
```

### 2) Configure environment

Create env files for each component from local templates/examples used in your branch/team process.

Minimum required values include:

- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or legacy `SUPABASE_SERVICE_KEY`), JWT/Auth settings, `ALLOWED_ORIGINS`, security/rate-limit settings (`SECURITY_ENABLE_HEADERS`, `AUTH_RATE_LIMIT_PER_MINUTE`, `ANALYZE_RATE_LIMIT_PER_MINUTE`, `PROTOCOL_RATE_LIMIT_PER_MINUTE`), and retention controls (`LAB_UPLOAD_RAW_RETENTION_DAYS`, `LAB_UPLOAD_RETENTION_BATCH_SIZE`)
- Frontend: API/CRM base URLs and Supabase public config
- CRM: `Auth` and `CrmData` sections (Issuer, Audience, JWK/JWKS path, Backend URL)

### 3) Run backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8004
```

### 4) Run frontend

```bash
cd frontend
npm install
npm run dev
```

### 5) Run CRM

```bash
cd crm-mvc
dotnet restore
dotnet run
```

## Auth Flow (Current)

1. User signs in on frontend via Supabase.
2. Frontend resolves destination and performs POST handoff to CRM `/auth/post-login`.
3. CRM stores `vo_access_token` cookie.
4. CRM validates token (ES256 via Supabase JWKS).
5. CRM requests backend `/auth/me` for user context.
6. Role-based redirect to `/ops`, `/admin`, or other CRM destination.

## Production Deployment

All deployments are performed from `main` and must keep server code in sync with GitHub.

### 🚀 Automated Deployment (Recommended)

We provide comprehensive deployment automation with safety checks, health verification, and rollback capability.

Before running deployment scripts, set the target host in your shell (do not commit real production host/IP into repository files):

```bash
export REMOTE_HOST="deploy@your-prod-host"
export REMOTE_DIR="/var/www/VITALOOP"
```

**Step 1: Push changes to GitHub**
```bash
git add .
git commit -m "feat/fix: ..."
git push origin main
```

**Step 2: Deploy to production**
```bash
# Verify all safety checks pass, then deploy with automatic backup
./scripts/deploy-prod.sh

# Or with custom options:
./scripts/deploy-prod.sh --force      # Force deploy ignoring warnings
./scripts/deploy-prod.sh --no-backup  # Skip creating backup branch
```

The deployment script performs a 6-phase rollout:
1. **Pre-deployment checks**: Git status, env vars, disk space, connectivity
2. **GitHub sync**: Confirms code is pushed to origin/main
3. **Server backup**: Creates backup branch with current state
4. **Code deploy**: Fast-forward git pull, rebuilds frontend/CRM, restarts services
5. **Service restart**: Restarts backend and CRM with health monitoring
6. **Validation**: Verifies all endpoints are responding (health, ready, frontend, CRM)

Security and retention operations:

- API header smoke check:
     - `./scripts/smoke_api_security_headers.sh`
- Install nightly retention timer (systemd):
     - `export REMOTE_HOST="deploy@your-prod-host"`
     - `export REMOTE_DIR="/var/www/VITALOOP"`
     - `./scripts/install_retention_timer.sh`
- Run retention redaction manually on backend host:
     - `cd /var/www/VITALOOP/backend && ./.venv/bin/python scripts/run_lab_retention_redaction.py --days 180 --batch-size 500 --apply`

### 📋 Manual Deployment (Legacy)

If automation is not available, follow the manual steps:

1. **Push changes**
```bash
git add .
git commit -m "feat/fix: ..."
git push origin main
```

2. **Sync server repository**
```bash
ssh "$REMOTE_HOST"
cd "$REMOTE_DIR"
git pull --ff-only origin main
```

3. **Deploy backend**
```bash
ssh "$REMOTE_HOST" 'systemctl restart vitaloop-backend && systemctl is-active vitaloop-backend'
```

4. **Deploy CRM**
```bash
ssh "$REMOTE_HOST" "
     systemctl stop vitaloop-crm-mvc &&
     cd '$REMOTE_DIR/crm-mvc' &&
     /usr/bin/dotnet publish Vitaloop.Crm.Web.csproj -c Release -o '$REMOTE_DIR/crm-mvc/publish' &&
     systemctl start vitaloop-crm-mvc &&
     systemctl is-active vitaloop-crm-mvc
"
```

5. **Deploy frontend**
```bash
ssh "$REMOTE_HOST" "
     cd '$REMOTE_DIR/frontend'
     npm ci && npm run build
"
```

### 🔄 Staging → Production Workflow

For testing before production:

```bash
# 1. Prepare on staging branch
git checkout staging
git pull origin staging
# Make changes...
git push origin staging

# 2. Promote staging to main (runs tests, builds, creates merge)
./scripts/promote-staging-to-prod.sh staging

# 3. Deploy to production
./scripts/deploy-prod.sh
```

### 🆘 Emergency Rollback

View recent commits without making changes:
```bash
./scripts/rollback.sh
```

Rollback to a specific commit (requires confirmation):
```bash
./scripts/rollback.sh abc1234 --confirm
```

The rollback script:
- Creates backup branch of current state
- Resets code to target commit
- Rebuilds frontend and CRM
- Restarts services
- Verifies health endpoints

### 🏥 Health & Monitoring

**Health Endpoints**
- **Liveness** (`/health`): Always returns 200 if service is running
- **Readiness** (`/health/ready`): Returns 200 only if all critical dependencies are ready
- **Detailed** (`/health/detailed`): Full service status for observability

Test health locally:
```bash
curl https://api.vitaloop.today/health
curl https://api.vitaloop.today/health/ready | jq
curl https://api.vitaloop.today/health/detailed | jq
```

Collect SLO metrics:
```bash
./scripts/collect-slo-metrics.sh
cat ./monitoring/slo-metrics.json | jq
```

### 📖 Full Documentation

For comprehensive deployment documentation, troubleshooting, and operations runbook, see [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md).

## Operations Checklist

After deploy:

1. ✅ `curl https://api.vitaloop.today/health` → 200 with `"status": "ok"`
2. ✅ `curl https://api.vitaloop.today/health/ready` → 200 with `"ready": true`
3. ✅ `curl https://vitaloop.today` → 200 (frontend loads)
4. ✅ `systemctl is-active vitaloop-backend` → `active`
5. ✅ `systemctl is-active vitaloop-crm-mvc` → `active`
6. ✅ `/auth/me` responds correctly with valid bearer token
7. ✅ CRM `/auth/post-login` sets `vo_access_token`
8. ✅ User reaches intended CRM route without auth loop

## Build Optimization

- Frontend uses **Vite with manual code splitting** for optimal performance
- Chunks split by vendor (React, charts, UI) and feature (Dashboard, analytics)
- Target: individual chunks < 200KB gzipped
- Monitor warnings: `npm run build 2>&1 | grep -i warning`

## Notes

- CRM must not be forced to HS256 via `Auth__JwtSecret` override when using Supabase ES256 tokens.
- Supabase role source of truth for CRM access is the user context returned by backend `/auth/me`.
- Keep production config and code paths aligned across frontend, backend, and CRM to avoid login loops.
- All deployment scripts include safety checks and error handling. Review output carefully.
