# VITATOOL V1.1.1 (VITALOOP)

Production: https://vitaloop.softdab.tech

VITATOOL is a web service for blood test interpretation:
upload report -> AI biomarker analysis -> personalized protocol -> weekly check-ins.

## Release Policy (Required)

1. Server Git must always be up-to-date with `origin/main`.
2. GitHub `main` must always reflect the real production code state.
3. New features and improvements are shipped only as versioned updates.

Current release: **V1.1.1**

## What Is Implemented on the Service

### Core Product

1. User authentication and session management.
2. Blood report upload and OCR extraction flow.
3. AI biomarker analysis endpoint.
4. Personalized protocol generation.
5. Weekly check-in flow.
6. Progress and historical health tracking.

### Frontend Experience

1. Modern landing page sections (hero, how-it-works, pricing, partners).
2. New body visualization components (`NeonBody`, `NeonBodyMini`).
3. Updated login and onboarding flow.
4. Mobile-first React + Vite UI.

### Backend and Data

1. FastAPI backend with stabilized check-in/protocol flows.
2. Supabase integration and migrations in `supabase_migrations.sql`.
3. Additional SQL bundles:
     - `backend/sql/FINAL_MIGRATION_BUNDLE.sql`
     - `backend/sql/auth_user_profile_sync.sql`
4. Knowledge base data source:
     - `backend/app/data/knowledge_base.json`

## Tech Stack

- Frontend: React, Vite, TailwindCSS
- Backend: FastAPI (Python)
- Data: Supabase (Postgres)
- AI: Anthropic/LLM pipeline
- Payments: Stripe (integration scaffolded)

## Local Development

```bash
git clone https://github.com/softdabtech/vitaloop.git
cd vitaloop

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Production Update Flow

### 1. Update GitHub

```bash
git add .
git commit -m "release: vitatool vX.Y.Z"
git push origin main
```

### 2. Sync Server Git (mandatory)

```bash
ssh root@159.65.252.227
cd /var/www/VITALOOP
git checkout main
git pull --ff-only origin main
```

### 3. Frontend deploy (proven method)

```bash
cd /Users/oleksii/projects/vitaloop/frontend
npm run build
rsync -az --delete dist/ root@159.65.252.227:/var/www/VITALOOP/frontend/dist/
```

## Versioning Going Forward

We now use explicit release versions for all future rollouts.

Format:
- Patch: `V1.1.2` (bug fixes)
- Minor: `V1.2.0` (new features)
- Major: `V2.0.0` (breaking changes)

Next features and improvements will be delivered only via new tagged versions.
