# VITALOOP ASP.NET Core MVC Migration
## Step 2 — MVC Foundation + Sneat Shell + VITALOOP Theme Foundation

Status: completed
Date: 2026-04-14

---

## What was built

1. Added a migration-safe MVC subproject at `crm-mvc/`.
2. Implemented route skeleton for:
   - `/auth/*`
   - `/admin/*`
   - `/ops/*`
   - `/organizations/*`
   - `/members/*`
   - `/invitations/*`
   - `/assignments/*`
   - `/settings/*`
   - `/billing/*`
3. Implemented layout hierarchy and shared shell partials:
   - `_CommonMasterLayout`
   - `_CrmLayout`
   - `_BlankLayout`
   - Sidebar / Topbar / Breadcrumbs / PageHeader / StatusStrip.
4. Added reusable UI building-block partials:
   - stat card
   - table shell
   - status pill
   - empty state
   - filter bar
   - modal shell
   - form section
   - info card.
5. Added VITALOOP theme foundation in centralized CSS token layer.
6. Added placeholder pages for Admin, Ops, Members, Invitations, Assignments, Organization Settings.

---

## Sneat usage decisions in Step 2

Used as structural reference only:
1. layout hierarchy concept (master -> shell -> page content).
2. sidebar + topbar + content composition pattern.
3. reusable partial-driven page composition.

Not imported:
1. demo pages and demo modules (ecommerce/academy/chat/analytics).
2. demo branding text and external promo links.
3. demo widgets and fake KPI blocks from Sneat samples.

---

## Theme foundation decisions

Theme layer location:
1. `crm-mvc/wwwroot/css/vitaloop-theme.css` — tokens.
2. `crm-mvc/wwwroot/css/vitaloop-shell.css` — shell/components.

Tokenized foundations:
1. colors (teal + neutral scale aligned to current VITALOOP style).
2. typography stack (SF/system style).
3. radius, shadows, spacing scale.
4. button, input, card, table, badge, modal primitives.

---

## Layout and routing decisions

1. Areas are used for route-boundary clarity:
   - `Areas/Admin`
   - `Areas/Ops`
2. Domain route controllers kept top-level in `Controllers/`.
3. Root route currently redirects to `/admin` for shell-first validation.
4. Domain logic intentionally remains stubbed via service contracts and stub implementations.

---

## Placeholder pages currently available

1. Admin dashboard.
2. Ops dashboard.
3. Organizations list + organization settings.
4. Members.
5. Invitations.
6. Assignments.
7. Settings.
8. Billing.
9. Auth login/forgot/reset placeholders.

---

## What moves to Step 3

1. Real auth/user-context domain migration (Stage 1-3 parity).
2. role-aware policies and super_admin bypass enforcement.
3. org-membership access checks.
4. invitation and onboarding flow backend integration.
5. subscription gating integration.
6. data repositories implementation.

---

## Locked Before Step 3 (Critical)

These decisions are final for Step 3 implementation.

### 1. Auth strategy: MVC as BFF over Supabase

Decision:
1. MVC works as BFF with server-side auth context.
2. Supabase JWT is validated on server.
3. Server builds canonical `UserContext`.
4. Razor views consume server-side context only.

Not allowed:
1. direct client-side Supabase flow as primary auth source inside MVC pages.

### 2. Active Organization Resolution

Decision:
1. server-side resolver is source of truth.
2. persistent org selection uses cookie.
3. fallback chain:
   - explicit route/query organization hint
   - cookie
   - first accessible org from memberships

Output:
1. one effective `ActiveOrganizationId` per request.

### 3. Access Enforcement Layer

Decision:
1. custom authorization attributes + policy service.
2. checks are based on Stage 3 model:
   - `global_role`
   - org-scoped role
   - subscription state
3. service-level checks remain for domain invariants, but request authorization is enforced at attribute/policy layer.

Implementation direction for Step 3:
1. introduce attributes like `RequireGlobalRole`, `RequireOrgRole`, `RequireSubscription`.
2. back attributes with unified access policy service.
3. keep explicit super_admin bypass where defined by domain rules.

---

## Production Blockers (Must be resolved)

1. JWT validation must be strict in production:
   - issuer check enabled
   - audience check enabled
   - expiration (`exp`) check enabled
   - signature validation enabled (JWT secret or public key)

2. `NullUserContextDataSource` is development-only and is a release blocker:
   - every call is logged as critical
   - must be replaced with DB-backed `IUserContextDataSource` before production deploy.
