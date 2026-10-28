# VITALOOP Senior Python / SaaS Architecture Fix Plan

Дата: 2026-05-28

Контекст: сервис уже прошел symptom-first продуктовый поворот и часть рискованных багов закрыта. Этот документ фиксирует оставшиеся инженерные задачи в порядке приоритета: production parity, subscription/entitlements, тесты, data integrity, health-loop domain model и SaaS reliability.

## P0: Production Parity

### Problem

Локально есть `/auth/entitlements`, но production API во время проверки возвращал `404` на:

- `/auth/entitlements`
- `/users/entitlements`

При этом локальный `auth.py` уже содержит route:

```python
@router.get("/entitlements")
async def get_entitlements(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    return await resolve_user_entitlements(user_id, current_user)
```

Это значит, что production backend не совпадает с текущим HEAD или route не попал в deploy.

### How To Fix

1. Проверить, какой commit/version сейчас в production.
2. Задеплоить актуальный backend.
3. После deploy проверить:

```bash
curl -H "Authorization: Bearer $TOKEN" https://api.vitaloop.today/auth/entitlements
curl -H "Authorization: Bearer $TOKEN" https://api.vitaloop.today/auth/me
```

4. Убедиться, что `/auth/me` возвращает поле `entitlements`.

### Acceptance Criteria

- `/auth/entitlements` returns `200`.
- `/auth/me.entitlements.is_premium === true` для premium user.
- Frontend больше не зависит от старых `subscription_status` как primary source.

## P0: Stripe Subscription Endpoint

### Problem

`/stripe/subscription` все еще считает premium/free статус своей логикой. Это оставляет риск subscription split-brain.

Current location:

```text
backend/app/routers/billing/stripe_router.py
```

### How To Fix

1. Импортировать canonical resolver:

```python
from app.services.entitlements import resolve_user_entitlements
```

2. В `get_subscription_status` заменить ручную subscription logic на resolver.
3. Отдельно оставить только upload count / freemium counters.

Recommended shape:

```python
@router.get("/subscription")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    user_id: str = current_user["sub"]
    entitlements = await resolve_user_entitlements(user_id, current_user)
    upload_count = await get_user_upload_count(user_id)

    limit = settings.freemium_upload_limit
    is_free = not entitlements["is_premium"] and entitlements["role"] == "end_user"

    return {
        "sub_status": entitlements["billing_status"],
        "plan_name": entitlements["plan_key"],
        "global_role": entitlements["role"],
        "is_premium": entitlements["is_premium"],
        "has_active_subscription": entitlements["has_active_subscription"],
        "cancel_at_period_end": entitlements.get("cancel_at_period_end", False),
        "upload_count": upload_count,
        "upload_limit": limit if is_free else None,
        "uploads_remaining": max(0, limit - upload_count) if is_free else None,
    }
```

### Acceptance Criteria

- `/auth/entitlements`, `/auth/me`, `/stripe/subscription`, `/dashboard/summary` показывают один и тот же subscription state.
- Premium user не получает free limits.
- Free user не получает premium features.

## P0: Backend Test Environment

### Problem

Backend tests не стартуют из-за:

```text
ModuleNotFoundError: No module named 'pywebpush'
```

Ошибка возникает при импорте `app.main`, потому что `notifications.py` импортирует `push_service.py`, а тот импортирует `pywebpush`.

### How To Fix

Preferred option: добавить dependency.

```text
pywebpush
```

в:

```text
backend/requirements.txt
```

Дополнительно сделать lazy/fail-soft import в `push_service.py`:

```python
try:
    from pywebpush import WebPushException, webpush
except ImportError:
    WebPushException = Exception
    webpush = None
```

И перед отправкой:

```python
if webpush is None:
    return {"ok": False, "reason": "push_not_configured"}
```

### Acceptance Criteria

```bash
pytest -q backend/tests/test_dashboard_summary_route.py
```

не падает на import.

## P0: Frontend Lint Errors

### Problem

`npm run lint` падает на 7 errors:

```text
frontend/src/__tests__/Upload.test.jsx
File is not defined
```

### How To Fix

Вариант 1: добавить browser/test globals в ESLint config.

Example:

```js
globals: {
  File: 'readonly',
}
```

Лучше: сделать override только для тестов:

```js
{
  files: ['src/__tests__/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}'],
  languageOptions: {
    globals: {
      File: 'readonly',
    },
  },
}
```

Вариант 2: локально mock-нуть `File` в тесте, если тесты запускаются в Node без DOM.

### Acceptance Criteria

```bash
npm run lint
```

без errors. Warnings можно снижать отдельной задачей.

## P0: Build / Postbuild Split

### Problem

`npm run build` собирает Vite/PWA, но падает на `react-snap`:

```text
Error: listen EPERM: operation not permitted 0.0.0.0:45678
```

Это sandbox/environment issue, но текущий script смешивает build и prerender.

### How To Fix

Разделить scripts:

```json
{
  "build": "npm run validate:env && vite build",
  "build:snap": "react-snap",
  "build:prod": "npm run build && npm run build:snap"
}
```

Если `postbuild` сейчас автоматически запускает `react-snap`, убрать его или оставить только в production-specific pipeline.

### Acceptance Criteria

- `npm run build` всегда green локально и в CI.
- `npm run build:prod` green только в deploy environment, где разрешен bind/listen.

## P1: Split `supabase_service.py`

### Problem

`backend/app/services/supabase_service.py` стал God-service. Он содержит:

- auth fallback;
- users;
- uploads;
- biomarkers;
- protocols;
- symptoms;
- subscriptions;
- admin aggregates;
- funnel;
- audit;
- notifications.

Это ускоряло MVP, но теперь мешает надежности и тестируемости.

### How To Fix

Создать явные repositories/services:

```text
backend/app/repositories/users.py
backend/app/repositories/subscriptions.py
backend/app/repositories/labs.py
backend/app/repositories/questionnaire.py
backend/app/repositories/audit.py
backend/app/services/health_loop.py
backend/app/services/entitlements.py
```

Мигрировать постепенно:

1. Вынести pure data access functions без изменения поведения.
2. Добавить/обновить unit tests.
3. Обновить imports в routers/services.
4. Оставить thin compatibility wrappers в `supabase_service.py`.
5. После стабилизации удалить неиспользуемые wrappers.

### Acceptance Criteria

- Новые фичи не добавляются в `supabase_service.py`.
- `supabase_service.py` остается compatibility/client utility layer.
- Domain logic живет в domain services.

## P1: Explicit Health Loop Domain Model

### Problem

Active concern сейчас хранится в:

```text
questionnaire_sessions.session_metadata
```

Это лучше, чем `localStorage`, но это все еще не полноценная доменная модель health loop.

### How To Fix

Добавить таблицы:

```text
health_concerns
health_concern_answers
lab_plan_recommendations
concern_upload_links
symptom_checkins
```

Минимальная структура `health_concerns`:

```sql
CREATE TABLE public.health_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_area TEXT,
  severity SMALLINT CHECK (severity BETWEEN 1 AND 10),
  duration TEXT,
  urgency_level TEXT DEFAULT 'routine'
    CHECK (urgency_level IN ('routine', 'timely_review', 'urgent')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'resolved', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_concerns_user_status
ON public.health_concerns(user_id, status);

ALTER TABLE public.health_concerns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Health concerns: users see own"
ON public.health_concerns
FOR SELECT
USING (auth.uid() = user_id);
```

Backend endpoints:

```text
GET /health-loop/current
GET /health-loop/concerns
POST /health-loop/concerns
PATCH /health-loop/concerns/{id}
GET /health-loop/concerns/{id}/lab-plan
POST /health-loop/concerns/{id}/link-upload
```

### Acceptance Criteria

- Today dashboard не зависит от questionnaire session metadata.
- Пользователь может иметь несколько concerns.
- Upload можно привязать к конкретному concern.
- Lab plan генерируется/хранится по concern.

## P1: Data Integrity Monitor

### Problem

Сейчас нет единого backend monitor-а, который заранее показывает расхождения в user/subscription/onboarding state.

### What To Check

- auth user без `public.users`;
- user без `user_profile`;
- user без `clients`;
- user без active/free subscription row;
- user с двумя active paid subscriptions;
- premium user без Stripe customer;
- free user с paid Stripe subscription id;
- onboarding stuck > 24h;
- concern без next action;
- questionnaire active session без updated_at долгое время.

### How To Fix

1. Добавить service:

```text
backend/app/services/data_integrity.py
```

2. Добавить endpoint:

```text
GET /admin/data-integrity
```

3. Добавить nightly job/report.
4. В Ops dashboard вывести блок `Data Integrity`.

### Acceptance Criteria

- Ops видит проблемы до пользователя.
- Можно выгрузить список affected users.
- Для каждого issue есть suggested remediation.

## P1: Subscription DB Constraints

### Problem

Есть normalized `subscriptions`, но нет достаточных partial unique constraints для защиты от нескольких active paid subscriptions.

### How To Fix

Перед индексом проверить дубликаты:

```sql
SELECT user_id, COUNT(*)
FROM public.subscriptions
WHERE status = 'active'
  AND plan_name IN ('core', 'personal')
  AND cancel_at_period_end = false
GROUP BY user_id
HAVING COUNT(*) > 1;
```

Если дубликатов нет:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_paid_per_user
ON public.subscriptions(user_id)
WHERE status = 'active'
  AND plan_name IN ('core', 'personal')
  AND cancel_at_period_end = false;
```

Optional:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_unique
ON public.subscriptions(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;
```

### Acceptance Criteria

- БД не позволяет создать две активные paid subscription для одного user.
- Entitlement resolver всегда выбирает paid active first.

## P1: Remove Legacy Subscription Reads

### Problem

В коде еще есть места, где subscription state читается напрямую из `users.sub_status`.

Examples:

```text
backend/app/routers/crm/*
backend/app/services/biomarker_service.py
backend/app/services/supabase_service.py
```

### How To Fix

1. Для user-facing логики использовать `resolve_user_entitlements`.
2. Для reporting использовать `subscriptions` или materialized entitlement view.
3. `users.sub_status` оставить только как backward compatibility field.
4. Добавить comments `deprecated`.

### Acceptance Criteria

```bash
rg "sub_status" backend/app
```

показывает только:

- admin compatibility;
- legacy migration support;
- non-critical reporting.

Core gating не использует `users.sub_status` напрямую.

## P2: Analysis Pipeline As Queue

### Problem

PDF/OCR/LLM analysis сейчас в основном живет в request lifecycle. Для SaaS это риск:

- HTTP timeout;
- retry complexity;
- expensive LLM call blocks request;
- сложно масштабировать workers separately.

### How To Fix

Добавить таблицу:

```text
analysis_jobs
```

Fields:

```text
id
user_id
upload_id
status: queued | processing | done | failed
attempt_count
last_error
created_at
started_at
completed_at
```

Flow:

1. Upload endpoint сохраняет файл/text и создает job.
2. Возвращает `job_id` быстро.
3. Worker обрабатывает OCR/LLM.
4. Frontend poll/SSE получает status.
5. Results появляются после `done`.

### Acceptance Criteria

- Upload request не зависит от длительности LLM.
- Failed job можно retry.
- Worker можно масштабировать отдельно.

## P2: API Contract Tests

### Problem

Ключевые API shape меняются, но нет явного contract gate.

### Endpoints To Cover

```text
GET /auth/me
GET /auth/entitlements
GET /stripe/subscription
GET /auth/onboarding/state
GET /questionnaire/session
PATCH /questionnaire/session/context
GET /dashboard/summary
```

### How To Fix

Добавить tests, которые проверяют shape, not snapshots:

```python
assert "entitlements" in data
assert isinstance(data["entitlements"]["is_premium"], bool)
assert "billing_status" in data["entitlements"]
```

### Acceptance Criteria

- Изменение API contract ломает test до deploy.
- Frontend и backend не расходятся по endpoint names.

## P2: Medical Data Safety

### Problem

Сервис работает с health/lab data. Нужно усилить PHI/data safety.

### How To Fix

1. Запретить raw lab text в logs/Sentry.
2. Добавить structured redaction для exceptions.
3. Добавить retention job для raw extracted text/PDF artifacts.
4. Audit log read/write для health-loop entities.
5. Разделить operational logs и medical audit logs.

### Acceptance Criteria

- Нет PHI в logs/Sentry.
- Есть retention policy.
- Можно ответить: кто и когда читал health data пользователя.

## P2: Frontend Query Layer

### Problem

`useSubscription` сейчас смешивает React Query data, local state и refetch. Это может давать race condition.

### How To Fix

1. Сделать `useEntitlements()` как основной hook.
2. `useSubscription()` оставить thin compatibility wrapper.
3. Не хранить derived state через `useState`, считать из query data.

Example:

```js
export function useEntitlements() {
  return useUserEntitlements()
}

export function useSubscription() {
  const { data, isLoading, refetch } = useEntitlements()
  const premium = Boolean(data?.is_premium)

  return {
    subStatus: String(data?.billing_status || 'free').toLowerCase(),
    isActive: premium,
    isPremium: premium,
    uploadLimit: premium ? Infinity : (data?.features?.upload_limit ?? 1),
    uploadsRemaining: premium ? Infinity : (data?.features?.upload_limit ?? 1),
    planName: data?.plan_key ?? null,
    loading: isLoading,
    refresh: refetch,
  }
}
```

### Acceptance Criteria

- Нет stale derived state.
- Paywall/sidebar/upload limits используют один источник.

## Recommended Execution Order

1. Deploy parity: `/auth/entitlements`.
2. Перевести `/stripe/subscription` на entitlement resolver.
3. Fix backend/frontend test gates.
4. Split build scripts.
5. Add data integrity monitor.
6. Add DB subscription constraints.
7. Add Health Loop tables.
8. Разобрать `supabase_service.py`.
9. Перевести analysis pipeline на queue.
10. Добавить API contract tests.
11. Усилить medical data safety.
12. Упростить frontend query layer.

## Final Target State

VITALOOP должен уметь надежно ответить на три вопроса одним способом во всех слоях:

1. Who is this user?
2. What health loop are they currently in?
3. What are they allowed to access?

Целевая архитектура:

```text
FastAPI Routers
  -> Domain Services
    -> Repositories
      -> Supabase

Frontend Hooks
  -> Stable API Contracts
    -> Canonical Backend State
```

Не должно быть разных вычислений subscription, health-loop state или onboarding state в разных частях приложения.
