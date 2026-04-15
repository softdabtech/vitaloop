# VITALOOP B2C Product Blueprint and Execution Plan

## 1. Product Vision (B2C first)
- Acquire user on `https://vitaloop.today`.
- Register/login user on `https://vitaloop.today/login`.
- Immediately enter personal health journey (not organization onboarding).
- Capture baseline (profile + historical labs + complaints).
- Run adaptive AI questionnaire (up to 50 questions).
- Deliver limited free value, convert to subscription.
- Drive continuous care loop: check-ins, re-tests, evolving recommendations.

## 2. Bounded Contexts
- **B2C App UI** (`vitaloop.today`): end-user product journey.
- **Ops CRM UI** (`crm.vitaloop.today`): internal/admin/practitioner operations.
- **Platform API** (`api.vitaloop.today`): shared auth, data, RBAC, analytics.

## 3. Canonical End-User Flow
1. Signup/Login
2. Onboarding basics
3. Upload historical labs
4. AI questionnaire
5. Free insight preview
6. Subscription paywall
7. Ongoing care cycle

## 4. Current State (Implemented)
- Signup sends user to `/onboarding`.
- `end_user` role auto-assigned by backend when role missing.
- Org setup gate removed for regular users.
- Frontend route guard enforces onboarding-first flow for end_user.
- New backend endpoint `/auth/onboarding/state` provides deterministic onboarding state.

## 5. Gap to Target State
- No explicit questionnaire engine with versioning/step analytics yet.
- No strict entitlement matrix tied to all feature entry points.
- No funnel-level analytics model (activation/conversion milestones).
- No workflow orchestrator for adaptive follow-up plans.

## 6. Execution Plan

### Phase 1 — Flow Lock (done/in progress)
- Enforce end-user path: signup -> onboarding -> dashboard.
- Prevent accidental redirects into org/ops pathways.
- Add route-level guard against skipping onboarding.

### Phase 2 — Onboarding State Machine (started)
- Add backend state endpoint (`/auth/onboarding/state`) with deterministic checklist:
  - profile basics
  - location
  - complaints
  - first upload
  - onboarding complete
- Add endpoint to mark onboarding complete (`/auth/onboarding/complete`).
- Migrate frontend guards to use the state endpoint.

### Phase 3 — Adaptive Questionnaire Engine
- Persistent questionnaire sessions and answers.
- Dynamic next-question generation with Abacus RouteLLM.
- Prompt/version tracking and fallback logic.
- Completion thresholds and scoring model.

### Phase 4 — Freemium to Paid Conversion
- Introduce strict free/paid access policy map.
- Gate premium insights and recommendations.
- Add conversion screens and trial-to-paid events.

### Phase 5 — Continuous Care Loop
- Weekly check-ins with trend deltas.
- Recommendation updates based on new labs/symptoms.
- Personalized “next best action” feed.

### Phase 6 — Ops Alignment
- Keep CRM MVC as operations back-office.
- Synchronize status/ownership/events between B2C app and CRM.
- Keep role boundaries explicit and auditable.

## 7. Delivery KPIs
- Activation: signup -> onboarding complete
- Time to first value: signup -> first insight
- Conversion: free -> paid
- Retention: weekly active check-ins
- Clinical engagement proxy: repeat lab uploads / month

## 8. Next Build Slice
- Add onboarding step progress UI powered by `/auth/onboarding/state`.
- Add dashboard gate cards for missing steps.
- Add first funnel event instrumentation (signup, onboarding complete, first upload, paywall shown).
