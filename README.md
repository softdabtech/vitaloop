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

- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, JWT/Auth settings, CORS origins
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

### 1) Push changes

```bash
git add .
git commit -m "feat/fix: ..."
git push origin main
```

### 2) Sync server repository

```bash
ssh root@159.65.252.227
cd /var/www/VITALOOP
git pull --ff-only origin main
```

### 3) Deploy backend

```bash
ssh root@159.65.252.227 'systemctl restart vitaloop-backend && systemctl is-active vitaloop-backend'
```

### 4) Deploy CRM

```bash
ssh root@159.65.252.227 '
  systemctl stop vitaloop-crm-mvc &&
  cd /var/www/VITALOOP/crm-mvc &&
  /usr/bin/dotnet publish Vitaloop.Crm.Web.csproj -c Release -o /var/www/VITALOOP/crm-mvc/publish &&
  systemctl start vitaloop-crm-mvc &&
  systemctl is-active vitaloop-crm-mvc
'
```

### 5) Deploy frontend

```bash
cd frontend
npm run build
rsync -az --delete dist/ root@159.65.252.227:/var/www/VITALOOP/frontend/dist/
```

## Operations Checklist

After deploy:

1. `systemctl is-active vitaloop-backend` -> `active`
2. `systemctl is-active vitaloop-crm-mvc` -> `active`
3. `/auth/me` responds correctly with a valid bearer token
4. CRM `/auth/post-login` sets `vo_access_token`
5. User reaches intended CRM route without auth loop

## Notes

- CRM must not be forced to HS256 via `Auth__JwtSecret` override when using Supabase ES256 tokens.
- Supabase role source of truth for CRM access is the user context returned by backend `/auth/me`.
- Keep production config and code paths aligned across frontend, backend, and CRM to avoid login loops.
