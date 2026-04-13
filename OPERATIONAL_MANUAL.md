# VITALOOP Operational Manual

Technical owner handoff document for Production operations.

> RU comment: Этот документ рассчитан на передачу следующему инженеру без устных пояснений.

## 1. Deployment & Updates

### 1.1 Frontend deployment (React + Vite + PWA)

Production frontend path:
- `/var/www/VITALOOP/frontend`
- Nginx serves static files from `/var/www/VITALOOP/frontend/dist`

Deploy/update steps:
```bash
ssh root@159.65.252.227
cd /var/www/VITALOOP/frontend
npm ci
npm run build
```

Post-build verification:
```bash
curl -I https://vitaloop.softdab.tech/
curl -I https://vitaloop.softdab.tech/manifest.webmanifest
curl -I https://vitaloop.softdab.tech/sw.js
```

Expected:
- `manifest.webmanifest` -> `content-type: application/manifest+json`
- `sw.js` -> `content-type: application/javascript`

> RU comment: Если MIME снова сломался, проверьте Nginx vhost `/etc/nginx/sites-available/vitaloop`.

### 1.2 Backend deployment (FastAPI + systemd)

Production backend path:
- `/var/www/VITALOOP/backend`
- Service: `vitaloop-backend`
- Unit file: `/etc/systemd/system/vitaloop-backend.service`

Deploy/update steps:
```bash
ssh root@159.65.252.227
cd /var/www/VITALOOP/backend
git pull
.venv/bin/pip install -r requirements.txt
systemctl restart vitaloop-backend
```

Health/log checks:
```bash
systemctl status vitaloop-backend --no-pager
journalctl -u vitaloop-backend -f
curl -sS https://vitaloop.softdab.tech/api/health
```

### 1.3 Safe Supabase migration procedure

Recommended sequence:
1. Open Supabase SQL Editor.
2. Run migration inside a transaction (`BEGIN ... COMMIT`) where possible.
3. Verify target objects (`\d+`, or `SELECT` against `information_schema.columns`).
4. Run one functional smoke test (new signup + `/users/me` + `/analyze`).

Critical current migrations to apply:
- `backend/sql/auth_user_profile_sync.sql`
- `supabase_migrations.sql` section 6 (`subscription_status`, `stripe_*`, `current_period_end`)
- `supabase_migrations.sql` `stripe_events` table

> RU comment: Сначала применяйте schema migration, потом backend release. Не наоборот.

---

## 2. Secrets Management

### 2.1 Backend `.env` variables

| Variable | Purpose | Rotation Source |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard -> Settings -> API |
| `SUPABASE_SERVICE_KEY` | Service role key for backend DB ops | Supabase Dashboard -> Settings -> API |
| `SUPABASE_JWT_PUBLIC_KEY_JWK` | ES256 JWT verification key | Supabase Auth/JWKS |
| `SUPABASE_JWT_SECRET` | Legacy HS256 fallback | Legacy projects only |
| `ROUTELLM_API_KEY` | RouteLLM auth | Abacus RouteLLM console |
| `ROUTELLM_BASE_URL` | OpenAI-compatible endpoint | `https://routellm.abacus.ai/v1` |
| `ROUTELLM_MODEL` | Routing/model selector | `route-llm` recommended |
| `STRIPE_SECRET_KEY` | Stripe server-side API key | Stripe Dashboard -> Developers -> API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | Stripe Dashboard -> Webhooks |
| `STRIPE_PRICE_ID` | Subscription billing price | Stripe Dashboard -> Products |
| `STRIPE_SUCCESS_URL` | Post-checkout redirect | App URL config |
| `STRIPE_CANCEL_URL` | Checkout cancel redirect | App URL config |
| `SENTRY_DSN` | Backend error reporting | Sentry project settings |
| `ENVIRONMENT` | Sentry environment tag | `production` in prod |
| `RESEND_API_KEY` | Email API key | Resend dashboard |
| `RESEND_FROM_EMAIL` | Sender identity | Verified Resend domain |
| `APP_ENV` | Runtime mode | `production` |
| `ALLOWED_ORIGINS` | CORS allowlist | App domain policy |
| `IHERB_RCODE` | Affiliate tracking | iHerb partner account |
| `IHERB_BASE_URL` | Affiliate base URL | Usually static |

### 2.2 Frontend `.env` variables

| Variable | Purpose | Rotation Source |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase URL | Supabase Dashboard |
| `VITE_SUPABASE_ANON_KEY` | Public anon/publishable key | Supabase Dashboard |
| `VITE_API_URL` | Backend API base URL | Infrastructure |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key | Stripe Dashboard |
| `VITE_SENTRY_DSN` | Frontend error reporting | Sentry project settings |

Secret rotation runbook:
1. Update `.env` values on server.
2. Restart backend (`systemctl restart vitaloop-backend`) for backend secret changes.
3. Rebuild frontend (`npm run build`) for `VITE_*` secret changes.
4. Smoke test login + checkout + analyze.

> RU comment: Любая ротация Stripe/Supabase ключей без smoke test = высокий риск тихой деградации.

---

## 3. AI Management (Prompts)

### 3.1 Prompt files

Current prompt files:
- `backend/app/prompts/extract_biomarkers.txt`
- `backend/app/prompts/generate_protocol.txt`

Update procedure:
1. Edit prompt text in Git.
2. Keep strict JSON contract language in prompts.
3. Deploy backend.
4. Run one controlled `/analyze` and one `/protocol` test.

### 3.2 Prompt versioning in DB

Version identifiers are hard-coded in service layer:
- `EXTRACT_PROMPT_VERSION = "extract_v1"`
- `PROTOCOL_PROMPT_VERSION = "protocol_v1"`

Storage:
- `lab_uploads.analyze_prompt_version`
- `protocols.prompt_version`

When changing semantics materially:
1. Bump version constants in `backend/app/services/claude_service.py`.
2. Deploy.
3. Verify new rows store the new version values.

> RU comment: Не меняйте существенно prompt без bump версии — иначе анализ инцидентов невозможен.

---

## 4. Troubleshooting Guide

### 4.1 Payment succeeded but subscription not active

Check sequence:
1. Verify webhook endpoint receives events:
```bash
journalctl -u vitaloop-backend -f | grep stripe
```
2. Validate webhook secret and price id in backend `.env`.
3. Check user subscription fields in `public.users` (`sub_status`, `sub_id`, optional `subscription_status`).
4. Check `public.stripe_events` for event presence (if migration applied).

If duplicated events are suspected:
- With `stripe_events` table present, webhook can dedupe by `event_id`.
- Without it, dedupe is best-effort only.

### 4.2 AI analyze/protocol errors

Checks:
1. Backend logs:
```bash
journalctl -u vitaloop-backend -f
```
2. Validate `ROUTELLM_API_KEY`, account status/quota in Abacus.
3. Confirm model value (`ROUTELLM_MODEL=route-llm`).
4. Inspect API response codes:
- `502 AI_UPSTREAM_ERROR` -> provider/network/rate limit issue
- `422 AI_INVALID_RESPONSE` -> provider returned malformed JSON

### 4.3 API error code reference for support

| HTTP | Code | Meaning | Support Action |
|---|---|---|---|
| `401` | `HTTP_ERROR` | Invalid/expired token | Ask user to re-login |
| `402` | `PAYWALL_REQUIRED` | Active subscription required | Route user to checkout |
| `404` | Domain-specific (`USER_NOT_FOUND`, `UPLOAD_NOT_FOUND`, etc.) | Missing entity | Validate account/upload linkage |
| `422` | `VALIDATION_ERROR` or `AI_INVALID_RESPONSE` | Invalid input or malformed AI output | Validate payload / retry analyze |
| `500` | `UNEXPECTED_ERROR`/internal | Backend internal error | Capture `request_id`, inspect logs |
| `502` | `AI_UPSTREAM_ERROR` | RouteLLM provider failure | Check Abacus/API key/rate limits |

> RU comment: Для саппорта обязательно сохраняйте `request_id` из ответа API.

---

## 5. Final Production Smoke Test (10-point pre-launch checklist)

1. Confirm no test secrets remain (`sk_test`, `pk_test`, test webhook endpoints) in production env files.
2. Confirm Stripe switched to Live Mode (`sk_live`, `pk_live`, live `price_...`, live webhook).
3. Verify `auth -> public.users` sync by registering a brand-new user and confirming a profile row exists.
4. Verify free-user flow: `/analyze` succeeds and returns `is_preview=true`; `/protocol` returns `402` (not `500`).
5. Verify paid-user flow: complete live checkout and confirm `/protocol` returns `200`.
6. Confirm webhook handling by checking subscription field updates after checkout and cancellation.
7. Confirm `public.stripe_events` exists and receives rows for webhook audit/idempotency.
8. Confirm PWA assets are reachable with correct MIME (`manifest.webmanifest`, `sw.js`).
9. Confirm transactional email delivery from verified production domain (Resend domain verified).
10. Delete test users/uploads/protocols and test Stripe artifacts from production data before first paid traffic.

> RU comment: Пункт 10 обязателен — платный запуск только после очистки тестовых данных.
