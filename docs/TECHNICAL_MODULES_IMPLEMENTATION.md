# VITALOOP Technical Modules Implementation Documentation

Updated: 2026-04-17
Repository: softdabtech/vitaloop
Status: As-is implementation map for restart planning

## 1. Purpose and Scope
This document is a detailed technical inventory of the current VITALOOP implementation. It covers:
- Runtime modules and boundaries
- Internal dependencies and integration points
- Request flows and data flows
- Operational scripts and deployment behavior
- Failure modes and technical debt drivers

This document is intentionally implementation-first (what exists now), not target architecture (what should exist).

## 2. System Context
Production endpoints:
- Frontend: https://vitaloop.today
- API: https://api.vitaloop.today
- CRM: https://crm.vitaloop.today

Core business workflow:
1. Authentication and session establishment
2. Lab document upload and extraction
3. Biomarker analysis and protocol generation
4. Tracking (progress, check-ins, timeline, insights)
5. CRM operations (orgs, members, practitioners, assignments)

Top-level runtime containers:
- frontend/: React + Vite SPA
- backend/: FastAPI monolith API
- crm-mvc/: ASP.NET 8 MVC app

## 3. High-Level Module Map
| Module | Path | Runtime | Responsibility |
|---|---|---|---|
| Web App | frontend/ | Node build, browser runtime | Public site + user cabinet + route guards |
| API | backend/app | Python runtime | Domain API, authz, analysis pipeline, CRM endpoints |
| CRM UI | crm-mvc/ | .NET runtime | Internal operations UI and access-gated workflows |
| Data Platform | Supabase | Managed | Postgres + Auth + JWT identity |
| Deploy/Operations | scripts/ | Shell | Deploy, rollback, smoke checks, retention jobs |

## 4. Backend Module Deep-Dive (FastAPI)
### 4.1 Composition Root
File: backend/app/main.py

Responsibilities:
- App initialization and version metadata
- Exception handler binding
- Middleware stack composition
- Rate-limiter backend selection
- Router registration for all domains
- Startup readiness logging

Cross-cutting behavior:
- CORS with explicit allowlist
- Optional security headers middleware
- Path-scoped rate-limit rules:
  - /auth
  - /analyze
  - /protocol

### 4.2 Configuration Module
File: backend/app/config.py

Pattern:
- Pydantic BaseSettings with env-backed config
- Derived properties for fallback key resolution

Configuration domains:
- Identity/Auth: Supabase URL, service keys, JWT settings
- AI: Anthropic and router model config
- Billing: Stripe keys, webhook secret, price id
- Messaging: Resend/SendGrid keys and sender addresses
- Security: header toggles, rate limit backend and redis options
- Retention: lab raw retention days and batch size
- URLs: frontend and CRM base URLs

Risk note:
- Configuration surface is broad and mostly flat; hidden coupling increases risk of env drift.

### 4.3 Dependencies and Authorization
Files:
- backend/app/dependencies.py
- backend/app/dependencies_crm.py

Identity module:
- Parses Bearer token via HTTPBearer
- Resolves signing key from Supabase JWKS
- Validates ES256 token with audience authenticated

Authorization module:
- End-user subscription gate for premium paths
- CRM context derivation from JWT + DB fallback
- Role gates:
  - super_admin
  - practitioner
  - end_user
- Organization context checks and membership checks
- Client-level access checks by role relationship

Failure modes:
- Any JWKS or token validation issue returns 401
- Subscription mismatch for end-user returns 402
- Context failures can return 403/500 depending on failure point

### 4.4 Middleware Modules
Path: backend/app/middleware/

request_context.py:
- Adds request-scoped correlation metadata

logging.py:
- Structured request/response logging behavior

security.py:
- SecurityHeadersMiddleware
- InMemoryRateLimiterBackend
- RedisRateLimiterBackend
- PathRateLimitMiddleware + rule matching

Operational implication:
- Rate-limiter behavior changes significantly by backend mode (inmemory vs redis).

### 4.5 Router Modules by Domain
Path: backend/app/routers/

Platform routers:
- health.py: liveness and readiness checks
- auth.py: user context and auth utility endpoints

End-user domain routers:
- analyze.py: extraction/analyze entry point
- protocol.py: protocol generation path
- progress.py: progress snapshots and trend data
- dashboard.py: aggregated dashboard response
- symptoms.py: symptom ingestion and retrieval
- complaints.py: recurring complaint capture
- checkins.py: weekly check-in endpoints
- timeline.py: activity timeline retrieval
- insights.py: insight generation/read/dismiss workflows
- red_flags.py: red-flag retrieval and acknowledge
- notifications.py: notification retrieval
- onboarding.py: onboarding step state and transitions
- questionnaire.py: questionnaire flow
- assignments.py: assignment lifecycle endpoints

Operations/B2B routers:
- crm.py and crm_stage5.py: CRM and organizational workflows
- admin.py: admin-level operational endpoints

Billing router:
- stripe_router.py: stripe checkout/session/webhook operations

### 4.6 Service Modules
Path: backend/app/services/

claude_service.py:
- Prompt orchestration and LLM calls

supabase_service.py:
- DB access helpers and query wrappers

crm_service.py:
- CRM-specific domain operations and adapters

assignment_service.py:
- Assignment prioritization and orchestration logic

email_service.py:
- Transactional email dispatch wrappers

affiliate.py:
- Referral/affiliate related behavior

Design issue:
- Business logic and infrastructure logic are partially interleaved.

### 4.7 Domain Contracts
Paths:
- backend/app/schemas/
- backend/app/models/
- backend/app/prompts/

Roles:
- schemas/: API I/O validation and serialization
- models/: internal domain objects
- prompts/: prompt templates and LLM instruction payloads

### 4.8 Backend Test Modules
Path: backend/tests/

Coverage areas:
- Analyze pipeline behavior
- Protocol behavior
- Input guards and route validation
- Rate-limit middleware behavior
- Runtime readiness checks
- Live staging smoke with Supabase token path

Known gap:
- No explicit end-to-end contract tests across frontend-backend-CRM handshake.

## 5. Frontend Module Deep-Dive (React + Vite)
### 5.1 Routing and Guarding
File: frontend/src/App.jsx

Routing architecture:
- BrowserRouter + lazy-loaded heavy pages
- Route fallback for lazy boundaries

Guard modules:
- ProtectedRoute: requires authenticated user
- EndUserFlowRoute: onboarding state gate
- CRMRoute: CRM role gate

Canonical user routes:
- /dashboard
- /upload
- /results/:uploadId
- /lab-results
- /assignments
- /assignments/:assignmentId
- /progress
- /insights
- /check-ins
- /onboarding
- /questionnaire
- /settings

Compatibility aliases:
- /timeline -> /insights
- /checkin -> /check-ins

### 5.2 Page Modules
Path: frontend/src/pages/

User core:
- UserDashboard.jsx: modern cabinet shell and content orchestration
- Upload.jsx: upload and OCR initiation flow
- Results.jsx: report result rendering
- LabResultsList.jsx: history and status aggregates
- Assignments.jsx and AssignmentDetails.jsx
- Progress.jsx: trend and timeline screen
- Insights.jsx: insight stream and timeline view
- WeeklyCheckIn.jsx
- Questionnaire.jsx
- Onboarding.jsx
- Settings.jsx

Legacy pages still present:
- Dashboard.jsx legacy route and components
- ClientAdmin.jsx and MasterAdmin.jsx

Public/marketing pages:
- Landing.jsx
- HowItWorks.jsx
- ExampleReport.jsx
- Privacy.jsx
- Terms.jsx

### 5.3 Component Modules
Path: frontend/src/components/

Dashboard module components:
- sidebar, stat cards, chart blocks, quick actions, timeline panel, recommendation panel

Upload/analysis UI components:
- UploadZone.jsx
- SymptomSelector.jsx

Progress and visualization components:
- ProgressChart.jsx
- BiomarkerMap and range bars

System UX components:
- Paywall
- LockedFeatureOverlay
- ErrorBoundary
- Skeletons
- RedFlagBanner
- SupportChat

Landing/marketing components:
- AnimatedSection and landing-specific blocks

### 5.4 CRM Feature-Sliced Frontend Modules
Path: frontend/src/features/crm/

Subdomains:
- clients/
- practitioners/
- programs/
- interventions/
- audit/
- components/

Behavior:
- These components are consumed by crm page wrappers and route adapters.

### 5.5 Hooks and State Modules
Path: frontend/src/hooks/

useAuth.js:
- session/user auth state and logout behavior

useSubscription.js:
- subscription status retrieval

useOnboardingState.js:
- onboarding status gating state

useCRMRoleAccess.js:
- role access capabilities for CRM routes/features

useCRMQuery.js:
- query/mutation abstraction for CRM modules

useOCR.js:
- OCR related local flow helper

useScrollReveal.js:
- animation/reveal behavior for landing sections

### 5.6 API and Utility Modules
Paths:
- frontend/src/api/
- frontend/src/lib/

API clients:
- client.ts
- crmAssignments.js
- crmClient.js
- crmClients.js
- crmOps.js
- crmPractitioners.js
- crmPrograms.js
- crmQuestionnaires.js

Utility modules:
- api.js: base transport client
- assignmentRouting.js
- assignmentScoring.js
- motion.js
- stripe.js
- supabase.js
- funnel.js
- store.js

### 5.7 Styling and Design Modules
Path: frontend/src/styles/

Styles present:
- global style layer
- dashboard2026 token layer
- user dashboard local styles
- tailwind classes and utility composition

Current challenge:
- Mixed styling paradigms (tailwind + inline styles + legacy css) increase maintenance cost.

## 6. CRM Module Deep-Dive (ASP.NET 8 MVC)
### 6.1 Composition and Pipeline
File: crm-mvc/Program.cs

Registered responsibilities:
- MVC and controller views
- Auth options and CRM data options binding
- secure cookie defaults
- forwarded headers handling
- named HttpClient for backend gateway
- startup blockers host service

Pipeline specifics:
- forwarded headers first
- static files + routing
- custom user context middleware injects user context into request items
- controller route mapping by areas + default route

### 6.2 Controllers
Path: crm-mvc/Controllers/

Controllers and responsibilities:
- AuthController.cs: login handoff and auth flow
- HomeController.cs: default shell views
- SettingsController.cs: user/org settings flow
- OrganizationsController.cs: org lifecycle and operations
- MembersController.cs: member listing/access operations
- InvitationsController.cs: invite flows
- AssignmentsController.cs: assignment operation views
- BillingController.cs: billing/plan screens

### 6.3 Areas
Path: crm-mvc/Areas/

Areas:
- Admin
- Ops
- Practitioner

Purpose:
- Role-scoped view routing and UI partitioning.

### 6.4 CRM Service Layer
Path: crm-mvc/Services/

Namespaces:
- Auth/
- Assignments/
- Data/
- Invitations/
- Memberships/
- Organizations/
- Contracts/
- Stubs/

Notable architecture signal:
- Stubs still present, indicating migration in-progress from placeholder to full implementations.

### 6.5 Access Attributes
Path: crm-mvc/Attributes/

Attributes:
- RequireGlobalRoleAttribute.cs
- RequireOrgRoleAttribute.cs
- RequireSubscriptionAttribute.cs

Purpose:
- Declarative authorization checks per controller/action.

## 7. Data Model Usage and Domain Grouping
The following tables are referenced by application code.

### 7.1 Identity and Access
- users
- subscriptions
- user_profile
- user_locations

### 7.2 Organization and CRM Core
- organizations
- organization_members
- organization_memberships
- invitations
- clients
- practitioners
- practitioner_assignments

### 7.3 Program and Assignment Domain
- programs
- client_programs
- interventions
- client_questionnaires

### 7.4 Lab and Clinical Signals
- lab_uploads
- biomarkers
- protocols
- symptoms
- recurring_complaints
- health_scores
- health_failures

### 7.5 Engagement and Tracking
- checkins_weekly
- timeline_events
- insights
- red_flag_events
- notifications

### 7.6 Questionnaire Domain
- questionnaires
- questionnaire_sessions
- questionnaire_answers

### 7.7 Audit and Billing
- audit_logs
- stripe_events

## 8. External Integrations
### 8.1 Supabase
- Auth: JWT identity and JWKS validation
- Data: primary relational storage via Postgres tables

### 8.2 LLM Providers
- Anthropic and router endpoint configuration in backend config
- Prompt execution in claude_service.py and prompts/

### 8.3 Stripe
- Billing integration through stripe_router.py
- Event persistence through stripe_events

### 8.4 Email Providers
- Resend and SendGrid settings present
- Email dispatch abstraction in email_service.py

## 9. Infrastructure and Operations Modules
### 9.1 Local Runtime
File: docker-compose.yml
- backend container service
- frontend dev container service

### 9.2 Deployment and Reliability Scripts
Path: scripts/
- pre-deploy-check.sh: git/env/connectivity/disk checks
- deploy-prod.sh: phased deploy orchestration with backup + validation
- rollback.sh: rollback to selected commit
- promote-staging-to-prod.sh: branch promotion flow
- collect-slo-metrics.sh: runtime metric capture
- smoke_api_security_headers.sh: security headers validation
- smoke_rate_limiter.sh: rate-limit behavior smoke
- install_retention_timer.sh: retention timer installer
- deploy_backend_safe.sh: backend-safe deployment helper

### 9.3 Retention
File: backend/scripts/run_lab_retention_redaction.py
- Batch process for raw lab content retention/redaction

## 10. Security and Compliance Controls (As Implemented)
Identity and token security:
- ES256 JWT verification via Supabase JWKS

Transport/session:
- Secure cookie policies in CRM
- CORS allowlist in backend

API hardening:
- Optional security headers middleware
- Path-scoped rate limiting with configurable backend

Authorization model:
- Role-based checks in both API and CRM
- Organization and client scope checks in dependencies_crm.py

Gaps to note:
- Authorization rules are split between backend and CRM, increasing risk of policy drift.

## 11. Observability and Runtime Diagnostics
- Structured request logging middleware in backend
- Startup readiness log summary in backend
- Health endpoints used by deploy validation:
  - /health
  - /health/ready
- Optional Sentry integration (dsn-driven)
- Post-deploy smoke checks for API security and rate limiting

## 12. Request Flow Deep-Dive
### 12.1 Auth Flow (Web User)
1. Frontend authenticates via Supabase
2. Frontend routes user to guarded pages
3. Backend validates bearer token via JWKS
4. End-user premium checks may gate specific endpoints

### 12.2 Dashboard Data Flow
1. Frontend requests dashboard summary endpoint
2. Backend aggregates block payloads (stats, assignments, actions, insights)
3. Frontend components render cards, charts, and actions

### 12.3 CRM Data Flow
1. CRM MVC resolves user context and role
2. CRM calls backend gateway endpoints
3. Backend applies role/org checks and returns scoped data

### 12.4 Upload to Insight Flow
1. Upload initiated from frontend
2. Backend analyze pipeline processes report and biomarkers
3. Protocol and insights endpoints materialize outputs
4. Progress/timeline/check-ins consume and update longitudinal state

## 13. Known Failure Modes (Observed and Potential)
1. Deployment script logic can block frontend rebuild and leave stale UI live.
2. Mixed legacy and new routes can create navigation ambiguity.
3. Duplicate policy enforcement layers (API and CRM) can diverge.
4. Monolithic backend context increases blast radius for unrelated changes.
5. Configuration sprawl increases risk of incomplete environment setup.

## 14. Technical Debt Register
### 14.1 Structural Debt
- Three-stack runtime coordination (React + FastAPI + ASP.NET)
- Partial feature duplication between legacy/new UI paths
- Incomplete migration artifacts (stubs in CRM services)

### 14.2 Code-Level Debt
- Mixed UI styling paradigms and inconsistent design tokens
- Domain logic leakage into UI orchestration layers
- Flat settings object without modular grouping by bounded context

### 14.3 Testing Debt
- Limited full-stack contract test coverage
- Live-smoke tests depend on external auth and env correctness

## 15. Restart Blueprint (Technical)
If restarting from zero, use this phased execution baseline.

### Phase 0: Baseline Freeze
- Freeze current APIs and DB schema snapshots
- Capture golden request/response contracts from production traffic
- Define non-functional targets (latency, error budget, deploy time)

### Phase 1: Domain Decomposition
Define bounded contexts with owners and APIs:
- Identity and Access
- Lab Ingestion and Analysis
- Protocol and Recommendations
- Progress and Check-ins
- CRM Operations
- Billing and Subscription

### Phase 2: Contract-First Build
- OpenAPI specs per context
- Typed DTOs and validation rules
- Explicit error taxonomy (4xx/5xx mapping)

### Phase 3: Policy Unification
- Single authorization policy engine/rule source
- Explicit org scope and data visibility rules
- Remove duplicated enforcement paths

### Phase 4: Delivery and Runtime Hardening
- Deterministic build artifacts and release manifests
- Staging parity checks and policy diff checks
- Automated canary + rollback gates

## 16. Recommended Follow-Up Documents
- docs/REBUILD_TARGET_ARCHITECTURE.md
- docs/DOMAIN_MODEL_V2.md
- docs/API_CONTRACT_V2.md
- docs/SECURITY_MODEL_V2.md
- docs/DEPLOYMENT_MODEL_V2.md
- docs/MIGRATION_PLAN_V2.md
- docs/NON_FUNCTIONAL_REQUIREMENTS_V2.md

## 17. Notes for AI-Assisted Rebuild Execution
For handoff to coding assistants (including Claude Code), keep these artifacts as source of truth:
- This document (as-is module inventory)
- API contract doc (target)
- Migration plan with acceptance criteria per phase
- Regression checklist for each critical user journey

Minimum prompt package for safe code generation:
1. Target architecture constraints
2. Strict route map and auth policy map
3. Endpoint contracts and examples
4. Definition of done per module
5. Required tests per module (unit + integration + smoke)
