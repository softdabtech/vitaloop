# VITALOOP — Rebuild Target Architecture

Status: Target design for phased rebuild
Created: 2026-04-17
Reference: TECHNICAL_MODULES_IMPLEMENTATION.md

---

## 1. Architecture Goals

| Goal | Current Gap | Target |
|---|---|---|
| Domain isolation | Monolithic FastAPI handles all domains | Bounded context modules with explicit APIs |
| Single auth policy | Rules split across FastAPI + ASP.NET | Unified policy engine, one enforcement path |
| Typed contracts | Mixed schema/model patterns, no OpenAPI spec | OpenAPI per domain, typed DTOs, versioned routes |
| Deploy determinism | Shell-based deploy with live state risk | Immutable artifact + staged rollout with gates |
| Observability | Partial logging, optional Sentry | Structured traces per request across all services |
| Test coverage | Smoke tests + partial unit tests | Unit + integration + contract + canary smoke |

Non-functional targets:
- API p95 latency ≤ 400 ms for all non-LLM endpoints
- LLM-backed endpoints ≤ 8 s p95 with client-visible streaming or loading state
- Deploy pipeline ≤ 12 min end-to-end including validation
- Rollback execution ≤ 3 min from trigger to stable state
- Zero-downtime deploy for any single domain change

---

## 2. Target System Topology

```
Browser / Mobile
       │
       ▼
  [ Nginx Reverse Proxy ]
  vitaloop.today          → Frontend SPA (React + Vite)
  api.vitaloop.today      → API Gateway → Domain Modules
  crm.vitaloop.today      → CRM UI (ASP.NET 8 MVC)
       │
       ▼
  [ Supabase ]
  - Postgres (primary store)
  - Auth (JWT / JWKS)
  - Storage (lab files)
       │
       ▼
  [ External Services ]
  - Anthropic / LLM Router
  - Stripe (billing)
  - Resend / SendGrid (email)
  - Redis (rate limiter, cache)
```

Key topology rules:
- CRM UI never queries Supabase directly; it calls API gateway only.
- Frontend never calls Supabase tables directly; all data goes through API.
- All secrets live server-side; frontend only holds the Supabase anon key + JWT.
- Redis is required in production; in-memory rate limiter is dev-only.

---

## 3. Bounded Context Map

### 3.1 Identity and Access (IAM)
**Owner**: Backend
**Boundary**: Everything about who the user is and what they can do.

Entities: `users`, `subscriptions`, `user_profile`, `user_locations`
API surface:
- `POST /auth/token/verify` — validate and decode JWT, return claims
- `GET /auth/me` — current user context
- `GET /auth/subscription` — subscription tier and validity

Authorization rules (canonical, no duplication in CRM):
- `super_admin` — full platform access
- `practitioner` — org-scoped client access
- `end_user` — own data only, premium gate on analysis paths
- `crm_admin` — org management and member ops

### 3.2 Lab Ingestion and Analysis
**Owner**: Backend
**Boundary**: File upload, OCR extraction, biomarker normalization, LLM analysis.

Entities: `lab_uploads`, `biomarkers`
API surface:
- `POST /analyze/upload` — receive file, initiate extraction job
- `GET /analyze/{upload_id}/status` — extraction/analysis job status
- `GET /analyze/{upload_id}/result` — normalized biomarker payload
- `POST /analyze/{upload_id}/reprocess` — admin re-trigger

Flow:
1. File received → stored in Supabase Storage
2. OCR extraction runs → raw text captured
3. Biomarker normalization pipeline runs → structured records written
4. LLM analysis triggered → result stored
5. Protocol generation triggered (see Protocol context)

### 3.3 Protocol and Recommendations
**Owner**: Backend
**Boundary**: Clinical recommendation generation from biomarker data.

Entities: `protocols`, `health_scores`, `health_failures`
API surface:
- `POST /protocol/generate` — trigger protocol for an upload
- `GET /protocol/{upload_id}` — retrieve latest protocol
- `GET /protocol/{upload_id}/history` — version history

LLM dependency: Anthropic via `claude_service.py`
Prompt management: `backend/app/prompts/` (to be versioned)

### 3.4 Progress and Engagement
**Owner**: Backend
**Boundary**: Longitudinal health tracking, check-ins, insights, timeline.

Entities: `checkins_weekly`, `timeline_events`, `insights`, `red_flag_events`, `notifications`, `symptoms`, `recurring_complaints`
API surface:
- `GET /dashboard` — aggregated dashboard payload
- `POST /checkins` — submit weekly check-in
- `GET /insights` — paginated insight stream
- `PATCH /insights/{id}/dismiss`
- `GET /timeline` — paginated event timeline
- `GET /red-flags` — active red flags
- `PATCH /red-flags/{id}/acknowledge`
- `GET /notifications`

### 3.5 Questionnaire Engine
**Owner**: Backend
**Boundary**: Adaptive questionnaire sessions with LLM-driven follow-ups and summary generation.

Entities: `questionnaires`, `questionnaire_sessions`, `questionnaire_answers`
API surface:
- `GET /questionnaire/start` — initialize session
- `POST /questionnaire/answer` — submit answer, receive next question or follow-up
- `GET /questionnaire/{session_id}/summary` — completed session summary
- `GET /questionnaire/{session_id}/status` — session state

LLM dependencies: `generate_questionnaire_followup`, `generate_questionnaire_summary` (in `claude_service.py`)

### 3.6 CRM Operations
**Owner**: Backend (API) + CRM UI (view layer)
**Boundary**: Organizations, practitioners, clients, programs, assignments.

Entities: `organizations`, `organization_members`, `organization_memberships`, `invitations`, `clients`, `practitioners`, `practitioner_assignments`, `programs`, `client_programs`, `interventions`, `client_questionnaires`
API surface (scoped to org via practitioner JWT):
- `/crm/organizations/*` — org CRUD and membership ops
- `/crm/clients/*` — client management
- `/crm/practitioners/*` — practitioner management
- `/crm/assignments/*` — assignment lifecycle
- `/crm/programs/*` — program and intervention management
- `/crm/invitations/*` — invite flows

CRM UI calls these endpoints; it holds no independent domain logic.

### 3.7 Billing and Subscription
**Owner**: Backend
**Boundary**: Stripe integration, subscription state, billing events.

Entities: `stripe_events`, `subscriptions`
API surface:
- `POST /billing/checkout` — create Stripe checkout session
- `GET /billing/portal` — Stripe customer portal URL
- `POST /billing/webhook` — Stripe event receiver (HMAC-verified)

Constraint: Webhook endpoint must bypass JWT auth and use Stripe signature verification only.

### 3.8 Platform Operations
**Owner**: Backend + scripts
**Boundary**: Health, readiness, audit logging, admin tooling.

API surface:
- `GET /health` — liveness
- `GET /health/ready` — readiness (checks DB + redis)
- `GET /admin/*` — admin-only ops endpoints (super_admin gate)

Entities: `audit_logs`
All write operations in CRM and API emit audit records.

---

## 4. Authorization Architecture (Target)

Single policy engine principle: all authorization decisions resolve from one place.

```
Request → JWT decode → Claims extraction
                          │
                          ▼
                   Policy Engine (backend/app/auth/policy.py)
                   ├── Role check (super_admin / practitioner / end_user)
                   ├── Subscription gate (premium paths)
                   ├── Org scope check (org_id from JWT or DB fallback)
                   └── Client scope check (practitioner→client relationship)
                          │
                     Allow / Deny (401 / 402 / 403)
```

CRM UI:
- Derives its access from the JWT it receives when a user logs in.
- Calls backend with that token — no separate CRM auth layer.
- `RequireGlobalRoleAttribute` and `RequireOrgRoleAttribute` become thin wrappers that re-use backend policy claims embedded in the JWT.

---

## 5. Data Architecture (Target)

### 5.1 Schema Organization
Group tables into schema namespaces (Postgres schemas) by bounded context:

| Schema | Tables |
|---|---|
| `iam` | users, subscriptions, user_profile, user_locations |
| `lab` | lab_uploads, biomarkers |
| `clinical` | protocols, health_scores, health_failures, symptoms, recurring_complaints |
| `engagement` | checkins_weekly, timeline_events, insights, red_flag_events, notifications |
| `questionnaire` | questionnaires, questionnaire_sessions, questionnaire_answers |
| `crm` | organizations, organization_members, invitations, clients, practitioners, practitioner_assignments, programs, client_programs, interventions, client_questionnaires |
| `billing` | stripe_events |
| `audit` | audit_logs |

### 5.2 Migration Strategy
- Existing tables remain in `public` schema until each context's module is rebuilt.
- New schema namespaces are introduced per context as rebuilds complete.
- Migration files versioned under `backend/sql/` with sequential naming.

### 5.3 Key Constraints
- Every table must have `created_at`, `updated_at` timestamps.
- Cross-context FK references use `UUID` IDs only; no joins across schema namespaces in application code.
- Soft deletes (`deleted_at`) preferred over hard deletes for audit-sensitive tables.

---

## 6. API Design Rules

1. All endpoints versioned under `/v1/` prefix once stable.
2. Every response follows envelope: `{ data: ..., meta: { request_id, timestamp } }`.
3. Error responses: `{ error: { code, message, details? } }`.
4. HTTP status semantics strictly enforced:
   - 200 OK (success)
   - 201 Created (new resource)
   - 202 Accepted (async job queued)
   - 400 Validation error
   - 401 Auth failure
   - 402 Subscription required
   - 403 Forbidden (auth valid, access denied)
   - 404 Not found
   - 429 Rate limited
   - 500 Internal error
5. All mutation endpoints idempotent where possible (safe retry).
6. LLM-backed endpoints support SSE streaming for long responses.

---

## 7. Frontend Architecture (Target)

### 7.1 Module Structure
```
frontend/src/
├── features/           ← domain feature slices (primary code home)
│   ├── auth/
│   ├── lab/
│   ├── protocol/
│   ├── progress/
│   ├── questionnaire/
│   ├── crm/
│   └── billing/
├── pages/              ← route entry points only, thin wrappers over features
├── components/         ← shared/system UI components only
├── hooks/              ← shared hooks (auth, subscription, etc.)
├── api/                ← typed API clients per domain
├── lib/                ← utilities with no business logic
└── styles/             ← design token layer only
```

### 7.2 Design Token Rules
All color, spacing, and typography values must come from Tailwind config tokens — no inline hex values or magic numbers in components. Dashboard2026 CSS vars and the `--brand` token must be reflected in `tailwind.config.js` as named values.

### 7.3 Routing Rules
- Public routes: Landing, HowItWorks, ExampleReport, Privacy, Terms.
- Protected routes: all /dashboard/* paths — require `ProtectedRoute`.
- CRM routes: /crm/* — require `CRMRoute` (practitioner or admin role).
- Onboarding gate: `EndUserFlowRoute` wraps dashboard entry.
- No legacy route aliases after rebuild (remove `/timeline` → `/insights`, `/checkin` → `/check-ins`).

---

## 8. Observability Architecture (Target)

Every request must produce:
1. Correlation ID (generated at Nginx or app boundary, propagated via header `X-Request-Id`).
2. Structured log line: `method`, `path`, `status`, `duration_ms`, `user_id` (if auth), `org_id` (if CRM), `request_id`.
3. Span for any external call (Supabase, Stripe, LLM, Redis).
4. Error events forwarded to Sentry (DSN required in production config).

Health endpoints must reflect actual dependency state:
- `/health` — process alive
- `/health/ready` — DB reachable + Redis reachable + LLM config present

---

## 9. Deployment Architecture (Target)

Artifact model:
- Frontend: static build artifact (dist/) — deployed to VPS, served by Nginx.
- Backend: Docker image — versioned by git SHA.
- CRM: .NET publish artifact — versioned by git SHA.

Deploy pipeline stages:
1. `pre-deploy-check.sh` — git, env, connectivity, disk.
2. Build artifacts (frontend `npm run build`, backend Docker build).
3. Backup current state.
4. Blue/green swap or rolling restart with health gate.
5. Post-deploy smoke: `smoke_api_security_headers.sh`, `smoke_rate_limiter.sh`, health check.
6. Canary validation window (5 min) — auto-rollback on error rate spike.

Rollback trigger:
- Manual: `./scripts/rollback.sh`
- Automatic: canary gate failure → immediate revert to previous artifact.

---

## 10. Migration Phasing

| Phase | Scope | Acceptance Criteria |
|---|---|---|
| Phase 0 | Freeze current API contracts, snapshot DB schema | Contract doc complete, no breaking changes from current prod |
| Phase 1 | Domain decomposition — define bounded contexts and owners | All contexts in this doc have OpenAPI specs |
| Phase 2 | Contract-first build — typed DTOs, explicit error taxonomy | All endpoints have schemas, validation, and tests |
| Phase 3 | Policy unification — single auth engine, remove CRM duplication | Single `policy.py`, CRM uses JWT claims only |
| Phase 4 | Delivery hardening — immutable artifacts, canary gates, staging parity | Zero-downtime deploys, automated canary rollback |

---

## 11. Out of Scope (Rebuild v1)

Items explicitly deferred to post-rebuild:
- Multi-region deployment
- Real-time subscriptions (WebSocket / Supabase Realtime)
- Mobile native app (React Native)
- Self-hosted LLM option
- Advanced analytics / BI layer
