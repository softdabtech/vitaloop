# VITALOOP New User Signup & Onboarding Audit

Дата: 2026-05-27

Контекст: аудит сценария нового пользователя после `Sign Up` в production и по коду.

Проверено визуально:

- `https://vitaloop.today/login?signup=true`
- `https://vitaloop.today/auth/confirmation?pending=1`

Проверено по коду:

- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/EmailConfirmation.jsx`
- `frontend/src/auth/postLogin.js`
- `frontend/src/pages/Onboarding.jsx`
- `backend/app/routers/identity/onboarding.py`

Цель: оценить регистрацию и первые шаги с точки зрения новой продуктовой парадигмы:

> Пользователь может прийти без анализов. Он регистрируется, говорит сервису что его беспокоит, отвечает на уточняющие вопросы, получает lab/doctor direction plan, затем загружает результаты и получает адаптивную стратегию.

## Current Signup Flow

Фактическая цепочка:

1. User opens `Sign up`.
2. Enters email and password.
3. If session is returned immediately: goes to `/onboarding`.
4. If email confirmation required: goes to `/auth/confirmation?pending=1`.
5. After confirmation/login, `resolvePostLoginDestination` sends end-user to `/onboarding` if `onboarding_completed=false`.
6. Current onboarding steps:
   - Basics
   - Goals
   - Location
   - Complaints
7. On complete, frontend calls `/profile`, `/profile/location`, `/complaints`, then `/auth/onboarding/complete`.
8. User lands on `/dashboard`.

Backend onboarding state also checks:

- profile basics;
- location;
- complaints;
- first upload;
- questionnaire completed;
- onboarding complete.

But frontend `Onboarding.jsx` marks onboarding complete after profile/location/complaints, without requiring first upload or questionnaire. This creates a product logic mismatch.

## Signup Page Audit

### What Works

- Form is short: email + password.
- Google signup option exists.
- Visual page feels premium and focused.
- No credit card friction.

### Problems Under New Strategy

1. Signup promise is outdated.

Current:

> Start your health optimization journey.

Side panel:

> Upload any lab result — AI analyzes every biomarker with comprehensive review.

Problem: this still tells the user the product starts with lab upload. It misses the new stronger hook: "Tell us what you feel; we help you decide what to check."

2. Privacy claims may be too strong or inconsistent.

Current:

> Your lab PDFs are processed entirely in your browser - never uploaded to our servers.

Problem: upload flow posts files to `/analyze/pdf`. If files go to backend or AI pipeline, this claim should be corrected before broad launch.

3. Password validation is too weak.

Current code accepts minimum 1 symbol.

Problem: for health data, this looks unserious and unsafe. It also undermines trust.

4. Signup has no intent capture.

The user signs up, then suddenly gets a profile form. The system misses the most valuable moment:

> Why are you here today?

## Email Confirmation Audit

### What Works

- Clear pending state.
- Email input for resend.
- Back to login.

### Problems

- Mixed language: English title, Russian body.
- The page does not reinforce why the user should return.
- No expectation setting: "After confirmation, we'll ask what you want to understand and help build your first plan."

Recommended copy:

Title:

> Confirm your email to start your health plan

Body:

> We sent a confirmation link. After you confirm, VITALOOP will help you describe your main concern, choose useful labs to consider, and build your first health loop.

Buttons:

- `Resend email`
- `Back to sign in`

## Current Onboarding Steps & Significance

### Step 1: Basics

Current fields:

- First name
- Last name
- Height
- Weight
- Current supplements
- Current medications

Significance: Medium-high.

Why it matters:

- Name is useful for personalization.
- Height/weight can matter for health context, but not always needed on minute one.
- Supplements and medications are important for recommendation safety.

Problems:

- Required height/weight may block a user who just wants to ask about a symptom.
- It starts with admin data, not user pain.
- It does not explain how medications/supplements affect safety strongly enough.

Recommendation:

Move basics after intent, or make it a short `Safety context` step.

Priority fields for first session:

- First name optional or inferred from email.
- Medications: important.
- Supplements: important.
- Height/weight: defer unless needed.

### Step 2: Goals

Current options:

- Improve energy
- Better sleep
- Weight management
- Boost immunity
- Hormonal balance
- Gut health
- Mental clarity
- Longevity & prevention

Significance: Medium.

Why it matters:

- Useful for personalization.
- Helps frame recommendations.

Problems:

- Goals are generic.
- They are not connected to the user's actual current concern.
- "Weight management" or "longevity" can distract from acute symptom/concern flow.

Recommendation:

Replace with:

> What brought you here today?

Options:

- I have symptoms and do not know what to check
- I already have lab results
- I want to improve energy/sleep/recovery
- I want prevention/longevity tracking
- I work with a practitioner

Then ask goals only as secondary.

### Step 3: Location

Current fields:

- Country
- City
- State/Region
- District/Area

Significance: Low-medium on day one.

Why it matters:

- Useful for future lab/practitioner referral.

Problems:

- It is too early.
- It asks many fields before the user has seen value.
- It may feel like data collection rather than care.

Recommendation:

Move later or make optional in a right-side "Improve doctor/lab suggestions" card.

For first onboarding, ask only:

- Country or region, optional.

### Step 4: Complaints

Current fields:

- Complaint
- Duration
- Tried interventions

Significance: Very high.

Why it matters:

- This is the doorway into the new product strategy.
- It is the first place where user state enters the system.

Problems:

- It appears last, after less emotionally relevant fields.
- It is called `Recurring complaints`, which sounds clinical and slightly negative.
- It does not ask severity, body location, triggers, related symptoms, or red flags.
- It does not produce a visible output.
- The copy says AI connects symptoms to biomarker patterns, but if user has no labs, it does not explain the pre-lab value.

Recommendation:

Move this to step 1 and rename to:

> What do you want to understand?

This should become `Symptom Check`.

## Critical Product Mismatch

Backend onboarding state expects `first_upload` and `questionnaire_completed`, but frontend onboarding completion skips both by setting `onboarding_complete=true`.

This means the product currently says:

- "Onboarding complete"

before the user has:

- completed adaptive questionnaire;
- created a lab plan;
- uploaded results;
- received first protocol.

Under the new paradigm, this should be changed.

Recommended model:

- `account_setup_complete`: email/profile basics done.
- `first_health_loop_started`: concern or upload started.
- `first_health_loop_complete`: concern + lab plan/upload + protocol/check-in path done.

Do not overload `onboarding_complete`.

## New Recommended Signup + Onboarding Flow

### Signup Page

Headline:

> Start with what you feel

Body:

> Create a free account to describe your main concern, get smart follow-up questions, and see what labs may help clarify your next step.

Primary button:

> Create account

Security copy:

> Your health data is protected with privacy-first safeguards and account-level access controls. VITALOOP does not sell your health data.

Avoid until legally verified:

- `PDF never leaves your device`
- `SOC2-compliant`
- `HIPAA-ready`

### Step 0: Intent Router

Question:

> What brought you to VITALOOP today?

Options:

1. `I have symptoms and want to know what to check`
2. `I already have lab results`
3. `I want a long-term health baseline`
4. `My practitioner invited me`

This step is critical because it controls the rest of onboarding.

### Path A: User Has Symptoms, No Labs

Step 1:

> What is the main thing you want to understand?

Input:

- Free text.
- Examples: "my leg hurts", "low energy", "poor sleep", "brain fog".

Step 2:

> Tell us a little more

Fields:

- Duration
- Severity 1-10
- Body area/system
- Better/worse triggers
- Related symptoms
- What tried so far

Step 3:

> Safety check

Ask red-flag questions based on category.

Example for leg pain:

- sudden severe pain?
- swelling in one leg?
- redness/heat?
- numbness/weakness?
- recent injury?
- chest pain or shortness of breath?

Output:

- If red flags: `Please seek qualified medical review urgently.`
- If no red flags: continue to lab direction.

Step 4:

> Your first lab direction

Show:

- possible contributing areas;
- suggested lab categories;
- doctor direction;
- what to track this week.

CTA:

- `Save lab plan`
- `Upload existing results`
- `Complete safety profile`

### Path B: User Has Labs

Step 1:

> Upload results

Step 2:

> Add symptom context

Ask:

- What are you trying to improve?
- Symptoms?
- Current medications/supplements?

Step 3:

> Results ready

Show:

- priority markers;
- first protocol;
- check-in setup.

### Path C: Long-Term Baseline

Step 1:

> Choose goals

Step 2:

> Build baseline lab plan

Step 3:

> Upload or schedule labs

### Path D: Practitioner Invite

Step 1:

> Confirm practitioner relationship

Step 2:

> Complete safety/profile context

Step 3:

> Upload labs or complete intake assigned by practitioner

## New Onboarding Screen Order

Recommended universal flow:

1. `Intent`
2. `Main concern or lab status`
3. `Smart follow-ups`
4. `Safety context`
5. `Lab direction / upload`
6. `Profile basics`
7. `Dashboard handoff`

Old order:

1. Basics
2. Goals
3. Location
4. Complaints

Replacement:

1. Intent
2. Concern
3. Symptom details
4. Safety check
5. Lab plan
6. Profile & meds
7. First action

## What To Remove Or Defer

Remove from first onboarding:

- Full city/state/district selector.
- Required height and weight before user states intent.
- Generic health goals as primary step.
- `Skip for now` as a tiny text link without explaining consequence.

Defer to Profile & Safety:

- Full location.
- Detailed goals.
- Height/weight.
- Prior diagnoses if not relevant to first plan.

Keep early:

- Current medications.
- Current supplements.
- Pregnancy/breastfeeding when relevant.
- Allergies.
- Main concern.
- Symptom duration/severity.

## First Dashboard After Onboarding

New user should not land on a generic dashboard.

They should land on `Today` with one of these states:

### If they started with symptoms

Hero:

> Your first health loop has started

Primary card:

> Current concern: Leg pain
> Next step: Answer 2 safety questions to finish your lab direction plan.

CTA:

> Continue symptom check

### If they uploaded labs

Hero:

> Your results are ready

Primary card:

> 3 priority markers need review
> Next step: Open your first protocol.

CTA:

> View results

### If they skipped

Hero:

> Start your first health loop

Cards:

- `Describe symptoms`
- `Upload lab results`
- `Build baseline plan`

## Significance Ranking

| Step / Element | Current Importance | New Importance | Decision |
| --- | --- | --- | --- |
| Email/password signup | High | High | Keep, simplify copy |
| Google signup | Medium | Medium | Keep |
| Email confirmation | High if enabled | High | Improve copy/language |
| First name | Medium | Low-medium | Defer or optional |
| Height/weight | Medium | Low at start | Defer |
| Current meds | High | Very high | Move early as safety |
| Current supplements | High | High | Move early as safety |
| Generic goals | Medium | Medium | Move after intent |
| Location | Low-medium | Low at start | Defer |
| Complaints | High | Critical | Move to first step |
| Questionnaire | Medium | Critical | Merge into Symptom Check |
| First lab upload | High | Conditional | Route based on intent |
| Dashboard handoff | High | High | Make contextual |

## UX Copy Replacements

### Signup

Current:

> Start your health optimization journey.

Replace:

> Start with symptoms, labs, or a health goal.

Current side panel:

> Upload any lab result — AI analyzes every biomarker with comprehensive review.

Replace:

> Tell VITALOOP what you feel. Get smart follow-up questions, a lab direction plan, and a protocol when results are ready.

### Onboarding Header

Current:

> Set baseline profile and goals for personalized protocol generation.

Replace:

> Let's understand what brought you here.

Current helper:

> Concrete profile data here influences your assignments, insights and recommendations.

Replace:

> Your answers help VITALOOP suggest useful labs, connect results to symptoms, and build safer recommendations.

### Complaints Step

Current:

> Recurring complaints

Replace:

> What do you want to understand first?

Current:

> What has been bothering you? We'll factor this into your analysis.

Replace:

> Describe your main concern in your own words. VITALOOP will ask follow-up questions and help decide what to check next.

### Completion Button

Current:

> Complete Profile

Replace based on path:

- `Create lab plan`
- `Continue to upload`
- `Start my health loop`

## Implementation Recommendations

### Phase 1: Copy + Order Fix

- Change signup copy.
- Change onboarding header.
- Move complaints/concern to first onboarding step.
- Rename `Complaints` to `Concern`.
- Add severity and duration.
- Move location later.
- Change final CTA.

### Phase 2: Intent Router

- Add first step: why are you here?
- Branch flow based on answer.
- Store intent in profile metadata or new table.

### Phase 3: Symptom Check MVP

Add:

- free-text concern;
- category/body area;
- severity;
- duration;
- red-flag answers;
- lab direction output.

### Phase 4: True Health Loop

Add backend entities:

- `health_concerns`
- `health_concern_answers`
- `lab_plan_recommendations`
- `concern_upload_links`
- `symptom_checkins`

## Success Criteria

A new user should understand within 60 seconds:

1. They can start without lab results.
2. VITALOOP wants to know what they feel first.
3. The system will ask smart clarifying questions.
4. The output is a practical next step: labs, doctor direction, upload, or protocol.
5. They are not being diagnosed by the app.
6. Uploading labs later will make the plan more precise.

## Supabase / Database Reliability Audit

Проверено по Supabase migrations, backend service layer и production API тестового пользователя `a@a.com`.

Ключевой вывод: БД уже содержит важные элементы для надежной работы пользователя (`users`, `user_profile`, `clients`, `subscriptions`, uploads, symptoms, notifications, timeline, RLS policies), но модель подписки и онбординга пока раздвоена. Это главный риск для новой продуктовой парадигмы: пользователь может не потеряться физически, но разные части продукта могут видеть его статус по-разному.

### Что проверено

- `supabase_migrations.sql`
- `backend/sql/stage-5-crm-tables.sql`
- `backend/sql/fix_crm_visibility.sql`
- `backend/sql/auth_user_profile_sync.sql`
- `backend/sql/FINAL_MIGRATION_BUNDLE.sql`
- `backend/app/services/supabase_service.py`
- `backend/app/dependencies.py`
- `backend/app/routers/billing/stripe_router.py`
- `frontend/src/hooks/useSubscription.js`
- `frontend/src/hooks/useFeature.js`
- `frontend/src/components/FeatureGate.jsx`
- `frontend/src/components/PaywallModal.jsx`

Read-only production check, 2026-05-27:

- `/auth/me`: `subscription_status=active`, `has_active_subscription=true`, `onboarding_completed=true`
- `/stripe/subscription`: `sub_status=active`, `plan_name=personal`, `is_premium=true`, `upload_count=17`, `has_stripe_customer=false`
- `/auth/onboarding/state`: `completed=true`, all checklist items true
- `/dashboard/summary`: `profile.subscription_status=active`, `stats.subscription=active`
- `/notifications`: `[]`
- `/uploads/recent`: 1 item
- `/lab-results`: 17 items

### User Identity Risk

Сейчас пользовательская сущность размазана по нескольким таблицам:

- `auth.users`
- `public.users`
- `public.user_profile`
- `public.clients`
- `public.subscriptions`

Есть SQL-скрипты, которые чинят пропуски (`fix_crm_visibility.sql`) и создают `clients`/free `subscriptions` через trigger. Это хорошо, но сам факт наличия нескольких repair scripts показывает риск: если один trigger не сработал или миграция применена не полностью, пользователь может быть создан в `auth.users`, но не получить нужные строки в продуктовых таблицах.

Рекомендация:

1. Сделать один canonical provisioning trigger на `auth.users`.
2. Он должен идемпотентно создавать:
   - `public.users`
   - `public.user_profile`
   - `public.clients`
   - free row in `public.subscriptions`
3. Добавить audit event `user_provisioned`.
4. Добавить ежедневный integrity job:
   - users without profile;
   - users without client;
   - users without subscription row;
   - premium users with conflicting statuses.

### Subscription Split-Brain

Сейчас подписка живет минимум в двух местах:

- legacy fields: `public.users.sub_status`, `public.users.subscription_status`, `public.users.plan_tier`
- normalized table: `public.subscriptions.status`, `public.subscriptions.plan_name`, Stripe fields

Backend уже частично признает этот конфликт:

- `/stripe/subscription` предпочитает `subscriptions`, но fallback делает на `users`.
- `require_active_subscription` тоже смотрит и `users`, и `subscriptions`.
- `/dashboard/summary` использует `get_user_account`, то есть зависит от `public.users`.
- Frontend `useSubscription()` берет `/stripe/subscription`, а при ошибке fallback-ится на `/auth/me`.

Это объясняет риск, который уже был виден в UX-аудите: один блок кабинета может считать пользователя premium, другой может показывать upgrade/paywall.

Рекомендация: ввести единый entitlement source.

Backend:

```text
GET /entitlements/me
```

Response:

```json
{
  "user_id": "uuid",
  "role": "end_user",
  "plan_key": "personal",
  "billing_status": "active",
  "is_premium": true,
  "is_trial": false,
  "is_past_due": false,
  "features": {
    "upload_limit": null,
    "lab_history": true,
    "trend_analysis": true,
    "advanced_protocol": true,
    "symptom_lab_plan": true
  },
  "source": "subscriptions",
  "needs_sync": false
}
```

Frontend:

- заменить `useSubscription()` на `useEntitlements()`;
- все paywall, sidebar, dashboard, upload limits, protocol/progress gates должны читать только этот hook;
- во время loading нельзя показывать upgrade;
- при error нельзя автоматически считать premium-пользователя free, нужно показывать neutral loading/error state и retry.

### Premium Users Must Not Receive Premium Upsell

Production check сейчас показывает для тестового пользователя:

- `is_premium=true`
- `plan_name=personal`
- уведомлений нет

Но риск остается из-за двух условий:

1. `has_stripe_customer=false` при `is_premium=true`.
2. Paywall может быть вызван любым компонентом через global event `paywall:trigger`, если конкретная страница получила 402 или локально решила, что доступа нет.

Что исправить:

- `PaywallModal` перед открытием должен проверять canonical entitlement.
- `FeatureGate` должен вызывать `onLocked` только если `entitlements.loaded=true` и `is_premium=false`.
- Backend 402 должен приходить только из единой функции `require_entitlement(feature)`.
- Нельзя создавать notification/email с upgrade copy, если `is_premium=true` или `role != end_user`.
- Добавить suppression rule:

```text
do_not_send_upgrade_prompt =
  entitlement.is_premium = true
  OR entitlement.billing_status IN ('active', 'trialing')
  OR user.global_role != 'end_user'
```

Для email/notification сервисов это должно быть обязательным guard, а не UI-only логикой.

### Database Constraints To Add

Минимальный набор защит, чтобы БД не позволяла продукту расходиться:

```sql
-- One CRM client per auth/product user.
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_unique
ON public.clients(user_id);

-- Stripe subscription id must remain globally unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_unique
ON public.subscriptions(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

-- Only one active paid subscription per user.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_paid_per_user
ON public.subscriptions(user_id)
WHERE status = 'active'
  AND plan_name IN ('core', 'personal')
  AND cancel_at_period_end = false;

-- Optional: only one active free subscription per user.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_free_per_user
ON public.subscriptions(user_id)
WHERE status = 'active'
  AND plan_name = 'free';
```

Важно: если business logic разрешает одновременно free row + paid row, resolver должен всегда выбирать paid active first. Иначе free row может перекрывать premium в UI.

### Recommended Entitlement Resolver

Логика выбора статуса должна быть одна:

1. Если `global_role != end_user`: доступ как staff/practitioner/admin, без B2C upsell.
2. Найти последнюю active paid subscription в `public.subscriptions`.
3. Если active paid есть и `cancel_at_period_end=false`: `is_premium=true`.
4. Если paid active нет, смотреть legacy `users.sub_status/plan_tier` только как fallback и помечать `needs_sync=true`.
5. Free active row не является premium.
6. `past_due` не должен выглядеть как free. Это отдельное состояние: доступ/ограничения решаются явно.
7. `paused/cancelled` не premium, но messaging должен быть billing-specific, не generic upgrade.

После этого:

- `/stripe/subscription`
- `/auth/me`
- `/dashboard/summary`
- `require_active_subscription`
- `require_freemium_analyze`
- notification/email guards

должны использовать один resolver.

### Onboarding State In DB

Сейчас есть `onboarding_completed` и checklist, где backend учитывает profile/location/complaints/first upload/questionnaire. Для symptom-first модели этого недостаточно.

Нужно разделить:

- `account_setup_complete`
- `first_health_loop_started`
- `first_health_loop_complete`
- `current_onboarding_step`
- `onboarding_intent`
- `primary_concern_id`

Новая БД должна хранить не просто факт завершения формы, а состояние health loop.

Recommended tables:

```text
health_concerns
health_concern_answers
lab_plan_recommendations
concern_upload_links
symptom_checkins
doctor_referral_suggestions
```

Связи:

- `health_concerns.user_id -> public.users.id`
- `health_concern_answers.concern_id -> health_concerns.id`
- `lab_plan_recommendations.concern_id -> health_concerns.id`
- `concern_upload_links.concern_id -> health_concerns.id`
- `concern_upload_links.upload_id -> lab_uploads.id`
- `symptom_checkins.concern_id -> health_concerns.id`

RLS:

```text
auth.uid() = user_id
```

Для practitioner/admin access нужно использовать отдельные policies через assignments, а не ослаблять user policy.

### Data Quality For New Product Paradigm

Чтобы пользователь "не потерялся", в кабинете должен быть не только dashboard, а recoverable state.

Добавить в БД:

- `user_health_state.current_focus`
- `user_health_state.last_meaningful_action_at`
- `user_health_state.next_recommended_action`
- `user_health_state.data_quality_score`
- `user_health_state.risk_flags_count`
- `user_health_state.entitlement_snapshot`

Это позволит показывать Today page даже если:

- пользователь не загрузил анализы;
- пользователь начал symptom check и ушел;
- у пользователя premium, но Stripe webhook задержался;
- есть противоречие между `users` и `subscriptions`.

### Priority Fixes

P0:

- Ввести canonical entitlement resolver.
- Подключить его к `/stripe/subscription`, `/auth/me`, `/dashboard/summary`, `require_active_subscription`, `require_freemium_analyze`.
- Запретить paywall/upgrade notification для `is_premium=true`.
- Добавить integrity query/job для пользователей без profile/client/subscription.

P1:

- Добавить unique indexes для active paid subscription.
- Разделить onboarding flags на account setup и health loop.
- Сделать symptom-first tables с RLS.
- В UI заменить все premium checks на единый `useEntitlements()`.

P2:

- Добавить admin/internal dashboard "Data Integrity":
  - orphan auth users;
  - users without profile/client/subscription;
  - subscription conflicts;
  - premium without Stripe customer;
  - free users with paid Stripe subscription id;
  - users stuck in onboarding > 24 hours.

### Final DB Assessment

База уже достаточно зрелая для текущего lab-first продукта, но для symptom-first стратегии нужно усилить не количество таблиц, а целостность состояния.

Самая важная продуктовая правка: VITALOOP должен уметь ответить на один вопрос в любой момент:

> Who is this user, what is their current health loop, and what are they allowed to access?

Пока ответ собирается из нескольких мест. Следующий backend milestone должен сделать этот ответ единым, проверяемым и используемым всеми страницами кабинета.
