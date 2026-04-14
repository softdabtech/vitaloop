# VITALOOP ASP.NET Core MVC Migration
## Step 1 — Audit + Migration Blueprint

Status: completed
Date: 2026-04-14

---

## 1. Scope of Step 1

This step is audit-only and blueprint-only.
No large rewrites were performed.

Goals covered:
1. Audit current VITALOOP structure.
2. Audit Sneat MVC template for reusable architectural parts.
3. Audit current VITALOOP UI as visual source of truth.
4. Build module mapping (current -> target MVC -> action).
5. Propose final ASP.NET Core MVC architecture.
6. Define migration waves.
7. Prepare foundation plan for Step 2.

---

## 2. Current Project Audit (as-is)

### 2.1 Runtime stack today
- Frontend: React + Vite + Tailwind + inline style system.
- Backend: FastAPI + Supabase/Postgres + Stripe scaffold + JWT dependencies.
- Data/auth: Supabase Auth, custom user context logic, Stage 1-3 auth/domain artifacts.

### 2.2 Current backend module shape
Observed in backend app modules and routers:
- Router-heavy FastAPI API surface.
- Service modules for Supabase and domain operations.
- Stage 3 additions already present:
  - auth context endpoint (`/auth/me`)
  - invitations flow
  - onboarding completion endpoint
  - role/subscription dependencies

### 2.3 Current frontend module shape
Observed in app routing and pages:
- Product pages: landing, upload, results, progress, check-in, dashboard.
- CRM-like pages already exist in React form:
  - client admin (`/admin`)
  - ops/admin (`/ops`)
  - onboarding (`/onboarding`)
  - auth pages (`/login`, `/reset-password`, `/accept-invite`)
- Auth routing already role-aware in app code.

### 2.4 Domain model status
Domain rules to preserve are already explicit and partially implemented:
- Access model: `global_role + org_membership_role + subscription_active`.
- Global roles: `end_user`, `support_admin`, `super_admin`.
- Org roles: `org_owner`, `client_admin`, `practitioner`, `end_user`.
- Core entities exist in SQL/domain docs and Stage 3 service code:
  - users, organizations, memberships, invitations, subscription canonical state, onboarding.
- Additional entity target to formalize in MVC phase:
  - practitioner_assignments.

Conclusion:
Current system has usable domain logic and route semantics, but architecture is split between React SPA and FastAPI service. MVC migration should keep domain semantics and move presentation shell to ASP.NET MVC.

---

## 3. Sneat MVC Audit (what to reuse, what to reject)

### 3.1 Reuse from Sneat (structure)
Take as foundation:
- MVC composition pattern (`Controllers`, `Views`, `Shared`, `wwwroot`, `Program.cs` pipeline).
- Shared layout hierarchy:
  - master layout
  - content/navbar layout
  - blank layout for auth screens.
- Layout partial sections:
  - sidebar (vertical menu)
  - navbar (topbar)
  - footer
  - style/script include sections.
- UI scaffolding patterns:
  - card/table/form/tab/modal containers
  - responsive content wrappers
  - route grouping via controllers and areas.

### 3.2 Reuse from Sneat (mechanics)
- Sidebar collapse behavior and viewport handling patterns.
- Shared vendor pipeline from `wwwroot` + section-based inclusion.
- Menu-based IA skeleton for admin navigation.

### 3.3 Explicitly reject/remove from Sneat
Must not be carried over:
- Demo content pages and lorem data.
- Template marketing links and theme branding remnants.
- Demo menu sections not related to VITALOOP domain:
  - eCommerce, Academy, Chat, Calendar, generic UI showcase pages.
- Demo-specific helper scripts/config that encode Sneat product semantics.

Conclusion:
Sneat is a UX and layout chassis only. Domain, routes, naming, policies, and visual system must be VITALOOP-native.

---

## 4. VITALOOP UI Audit (visual source of truth)

### 4.1 Brand tokens identified
From current frontend styles/components:
- Primary palette is teal-centered:
  - dark teal anchors (`--teal-900`, `--teal-800`)
  - accent CTA (`--teal-500`)
  - supporting tints (`--teal-300`, `--teal-50`).
- Neutral palette:
  - `--gray-950` to `--gray-50`, high contrast typography strategy.
- Typography:
  - system stack with SF Pro emphasis.
- Shapes:
  - rounded cards/buttons, pill CTAs.
- Motion language:
  - subtle reveal/stagger/fade/float, not heavy dashboard animation.

### 4.2 Tone and UI behavior
- Product tone is medical-tech but premium and approachable.
- Forms and cards are clean, soft-border, high legibility.
- Admin shell currently dark-leaning in some pages, landing is light and airy.

### 4.3 Branding implication for MVC migration
- Keep Sneat layout geometry, but re-skin all design tokens:
  - colors, typography, radius, shadows, spacing density, icon tone.
- Replace Sneat demo visual signatures (`Public Sans`, default purple/blue emphasis, demo badges) with VITALOOP tokens.

---

## 5. Mapping: Current Module -> Target MVC Module -> Action

| Current module | Target MVC module | Action |
|---|---|---|
| FastAPI routers (`backend/app/routers/*`) | MVC Controllers by bounded context | port |
| FastAPI service modules (`backend/app/services/*`) | Application Services + Repositories | port + rewrite (C#) |
| Supabase dependency helpers (`dependencies.py`) | Authorization policies/filters + UserContext service | port + adapt |
| SQL migration artifacts (`backend/sql/*.sql`) | EF Core migrations + SQL compatibility scripts | keep + adapt |
| React route guards in `App.jsx` | MVC route policy attributes + action filters | rewrite |
| React `authResolver.js` | MVC post-auth redirect orchestrator service | port |
| React `AuthContext.jsx` | server-side UserContext provider (claims + db context) | replace |
| React auth pages (`Login`, `ResetPassword`, `AcceptInvite`) | `AuthController` + `Views/Auth/*` | port + redesign (Razor) |
| React admin pages (`ClientAdmin`, `MasterAdmin`) | `Admin`/`Ops` areas with Razor views | rewrite (UI shell), port domain logic |
| React domain pages (`Onboarding`, members/invites flows) | `Organizations`, `Members`, `Invitations`, `Assignments` controllers + views | rewrite |
| Current landing/product pages | separate public site module (kept React or future MVC front) | keep (phase-decoupled) |
| Demo/Sneat sample pages | none | remove |
| Demo/Sneat menu taxonomy | VITALOOP route map taxonomy | replace |

Legend:
- keep: preserve mostly as-is.
- port: transfer logic with equivalent behavior.
- rewrite: rebuild in target stack.
- replace: remove old mechanism, use new pattern.
- remove: deprecate fully.

---

## 6. Target ASP.NET Core MVC Architecture

### 6.1 Project structure (target)

```text
Vitaloop.Crm.Web/
  Controllers/
    AuthController.cs
    OrganizationsController.cs
    MembersController.cs
    InvitationsController.cs
    AssignmentsController.cs
    SettingsController.cs
  Areas/
    Admin/
      Controllers/DashboardController.cs
      Views/...
    Ops/
      Controllers/OpsController.cs
      Views/...
  Services/
    AuthService.cs
    UserContextService.cs
    InvitationService.cs
    OrganizationService.cs
    MembershipService.cs
    AssignmentService.cs
    SubscriptionService.cs
  Repositories/
    Interfaces/
    SupabaseOrEfImplementations/
  Policies/
    AccessPolicyNames.cs
    AccessPolicyHandlers.cs
  ViewModels/
    Auth/
    Organizations/
    Members/
    Invitations/
    Assignments/
    Billing/
  Views/
    Shared/
      _CommonMasterLayout.cshtml
      _ContentNavbarLayout.cshtml
      _BlankLayout.cshtml
      Sections/
    Auth/
    Organizations/
    Members/
    Invitations/
    Assignments/
    Settings/
  wwwroot/
    css/
      vitaloop-theme.css
      vitaloop-components.css
    js/
      menu.js
      app.js
    img/
```

### 6.2 Route map (native MVC)
- `/auth/*`
- `/admin/*`
- `/ops/*`
- `/organizations/*`
- `/members/*`
- `/invitations/*`
- `/assignments/*`
- `/settings/*`
- `/billing/*`

### 6.3 Authorization model in MVC
- Policy inputs:
  - global role
  - org membership role (org-scoped)
  - subscription state
- Must preserve:
  - super_admin bypass where explicitly allowed
  - practitioner as org-scoped role only
  - subscription gating as explicit policy

### 6.4 Domain invariants to keep unchanged
- User context is first-class object.
- Invitation acceptance flow is first-class.
- Onboarding completion gate is first-class.
- Role-aware routing and org-aware access are first-class.
- Apple OAuth readiness remains placeholder-capable.

---

## 7. Migration Waves (safe phased execution)

### Wave 0 — Preparation
- Freeze domain contracts from Stage 1-3 docs.
- Add acceptance criteria matrix for each route and role combination.

### Wave 1 — MVC Foundation (no domain cutover)
- Create ASP.NET MVC shell.
- Import/prune Sneat layout skeleton.
- Replace menu IA with VITALOOP route map placeholders.

### Wave 2 — Auth + UserContext parity
- Implement auth controllers/views and post-auth redirects.
- Implement `UserContextService` and policy helpers.
- Parity-check with existing `/auth/me` semantics.

### Wave 3 — Organizations/Members/Invitations
- Port org and invitation flows.
- Enforce org-scoped policy checks.
- Keep subscription gates explicit.

### Wave 4 — Assignments + Billing + Settings
- Add practitioner assignments flows.
- Add billing views and subscription state surfaces.
- Consolidate settings pages.

### Wave 5 — Visual Rebrand Completion
- Apply VITALOOP design tokens to full CRM shell.
- Remove remaining Sneat visual traces.

### Wave 6 — Legacy Cutover + Cleanup
- Decommission obsolete React admin routes and FastAPI duplication.
- Retain only required APIs/integration points.
- Finalize route/controller/view consistency.

### Wave 7 — Documentation + Handover
- Migration summary, architecture map, domain map, route map, TODO backlog.

---

## 8. Foundation Plan for Step 2

Step 2 target: establish MVC shell and route skeleton only.

### 8.1 Deliverables
1. New ASP.NET Core MVC project scaffold in repo (parallel to existing stack).
2. Sneat-derived layout core imported and pruned:
   - keep: master/content/blank layouts, sidebar/topbar partial structure.
   - remove: demo menu sections/pages/scripts not needed.
3. VITALOOP route skeleton controllers and empty views:
   - Auth, Organizations, Members, Invitations, Assignments, Settings, Billing, Admin area, Ops area.
4. Navigation rewritten to target route map.
5. Initial VITALOOP theme token file in `wwwroot/css`.

### 8.2 Non-goals for Step 2
- No full domain migration yet.
- No complete data access implementation yet.
- No full UX polishing yet.

### 8.3 Exit criteria for Step 2
- App runs in MVC with working shell.
- Sidebar/topbar render with VITALOOP naming and route links.
- No Sneat demo menu/content visible.
- Auth/admin/ops/public shell routing works as empty stubs.

---

## 9. Risks and blockers identified

1. Mixed runtime transition risk:
- During migration, React/FastAPI and MVC may coexist.
- Need clear traffic routing strategy (subpath or subdomain) to avoid auth/session confusion.

2. Auth provider coupling risk:
- Current auth flows are deeply tied to Supabase JS flows.
- MVC flow needs explicit strategy for Supabase JWT/refresh handling on server side.

3. Data access migration risk:
- Existing SQL and Supabase table contracts must remain canonical.
- EF Core model mapping must not alter domain semantics accidentally.

4. UI drift risk:
- Sneat default classes can override VITALOOP visual language if tokens are not applied early.

5. Authorization regression risk:
- Incorrect mapping of `global_role` vs org role can produce privilege leaks.

Mitigation in next step:
- Build policy matrix tests before domain port waves.
- Keep a route-by-route parity checklist against Stage 3 behavior.

---

## 10. Step 1 completion statement

Step 1 is complete:
- audit performed,
- migration blueprint defined,
- wave plan and Step 2 foundation plan prepared.

Ready for Step 2 (Foundation implementation).
