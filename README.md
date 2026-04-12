# VITALOOP — Biohacking-as-a-Service

Mobile-first web app: upload blood test → AI biomarker analysis → personalized supplement protocol → track progress.

**Stack:** React + Vite · FastAPI · Claude AI · Supabase · Stripe · Tailwind CSS

---

## Project Structure

```
vitaloop/
├── backend/          # FastAPI (Python)
├── frontend/         # React + Vite
├── supabase_migrations.sql
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### 1. Clone & configure

```bash
git clone https://github.com/softdabtech/vitaloop.git
cd vitaloop
```

Copy env files and fill in your keys:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Required keys:
| Variable | Where to get |
|---|---|
| `SUPABASE_URL` | Supabase project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase project Settings → API (service_role) |
| `VITE_SUPABASE_ANON_KEY` | Supabase project Settings → API (anon) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe Dashboard → Developers |

### 2. Set up Supabase database

Open Supabase SQL Editor → paste contents of `supabase_migrations.sql` → Run.

### 3. Run locally (Docker)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 4. Run manually

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

```
Browser
  └─ PDF.js + Tesseract.js (OCR — runs locally, PDF never sent)
       └─ FastAPI POST /analyze (extracted text only)
            └─ Claude API (biomarker extraction + protocol)
                 └─ Supabase Postgres (users, biomarkers, protocols)
```

> **HIPAA note:** Raw PDFs never leave the user's device. Only OCR-extracted text is sent to the server.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/analyze` | Extract biomarkers from OCR text |
| POST | `/protocol` | Generate supplement protocol |
| GET | `/progress/{user_id}` | Get biomarker history |

---

## Deployment (Railway)

1. Push to `main` — GitHub Actions deploys automatically.
2. Set secrets in GitHub: `RAILWAY_TOKEN` + all env vars.

---

## Roadmap

- [x] Week 1 — Auth, File Upload, OCR
- [x] Week 2 — AI Engine (biomarker extraction + protocol)
- [x] Week 3 — UX: Health Avatar, Progress Tracker
- [ ] Week 4 — Stripe payments, production launch
