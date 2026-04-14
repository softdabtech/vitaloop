# Vitaloop CRM — Final Migration Report

> **Project**: `Vitaloop.Crm.Web` (ASP.NET Core MVC, .NET 8)  
> **Path**: `crm-mvc/`  
> **Status**: Step 6 complete — production-ready shell, no legacy placeholders

---

## Architecture Overview

```
Browser
  └── ASP.NET Core MVC (.NET 8)
        ├── Auth Middleware  ← JWT from vo_access_token cookie (Supabase RS256/HS256)
        ├── ActiveOrganizationResolver  ← reads vo_active_org_id cookie
        ├── RequireOrgRole filter  ← org-scoped RBAC
        ├── Controllers
        │     ├── HomeController          → /, /error, /error/{statusCode}
        │     ├── AuthController          → /auth/*, /organizations/switch/{id}
        │     ├── OrganizationsController → /organizations/*
        │     ├── MembersController       → /organizations/members/*
        │     ├── InvitationsController   → /organizations/invitations/*
        │     ├── AssignmentsController   → /organizations/assignments/*
        │     ├── BillingController       → /billing
        │     └── SettingsController      → /settings
        ├── Areas/Admin/Controllers/DashboardController  → /admin
        └── Areas/Ops/Controllers/DashboardController    → /ops
              │
              ▼
        ICrmDataGateway (HttpCrmDataGateway)
              │
              ▼
        FastAPI backend at CrmData:BaseUrl (configurable, default localhost:8000)
```

---

## Route Table

| Method | Route | Controller / Action | Auth |
|--------|-------|---------------------|------|
| GET | `/` | `HomeController.Index` | Authenticated |
| GET | `/health` | `HomeController.Health` | Anonymous |
| GET | `/error` | `HomeController.Error` | Anonymous |
| GET | `/error/{statusCode}` | `HomeController.StatusCodeError` | Anonymous |
| GET | `/auth/login` | `AuthController.Login` | Anonymous |
| GET | `/auth/forgot-password` | `AuthController.ForgotPassword` | Anonymous |
| GET | `/auth/reset-password` | `AuthController.ResetPassword` | Anonymous |
| GET | `/auth/logout` | `AuthController.Logout` | Anonymous |
| GET | `/organizations/switch/{id:guid}` | `AuthController.SwitchOrganization` | Authenticated (membership check) |
| GET | `/organizations` | `OrganizationsController.Index` | org_owner, client_admin |
| GET/POST | `/organizations/settings` | `OrganizationsController.Settings` | org_owner, client_admin |
| GET | `/organizations/members` | `MembersController.Index` | org_owner, client_admin |
| POST | `/organizations/members/add` | `MembersController.Add` | org_owner, client_admin |
| POST | `/organizations/members/remove` | `MembersController.Remove` | org_owner, client_admin |
| GET | `/organizations/invitations` | `InvitationsController.Index` | org_owner, client_admin |
| POST | `/organizations/invitations/send` | `InvitationsController.Send` | org_owner, client_admin |
| POST | `/organizations/invitations/revoke` | `InvitationsController.Revoke` | org_owner, client_admin |
| GET | `/organizations/assignments` | `AssignmentsController.Index` | org_owner, client_admin |
| POST | `/organizations/assignments/assign` | `AssignmentsController.Assign` | org_owner, client_admin |
| POST | `/organizations/assignments/unassign` | `AssignmentsController.Unassign` | org_owner, client_admin |
| GET | `/billing` | `BillingController.Index` | Authenticated |
| GET | `/settings` | `SettingsController.Index` | Authenticated |
| GET | `/admin` | `Areas/Admin DashboardController.Index` | org_owner, client_admin |
| GET | `/ops` | `Areas/Ops DashboardController.Index` | org_owner, client_admin |

---

## Environment Setup

### Required environment variables / appsettings

```jsonc
{
  "Auth": {
    "TokenCookieName": "vo_access_token",           // JWT token cookie name
    "ActiveOrganizationCookieName": "vo_active_org_id",
    "ExpectedIssuer": "https://your-project.supabase.co/auth/v1",
    "ExpectedAudience": "authenticated",
    "SupabaseJwtSecret": "",                         // HS256: HMAC secret from Supabase
    "SupabaseJwtPublicKeyPem": ""                    // RS256: PEM public key (preferred for prod)
  },
  "CrmData": {
    "BaseUrl": "https://your-api.example.com",       // FastAPI backend base URL
    "TimeoutSeconds": 30,                            // Optional; default 30
    "OrganizationsPath": "/api/admin/organizations",
    "OrganizationSettingsPath": "/api/admin/organizations/{orgId}/settings",
    "MembersPath": "/api/admin/members",
    "InvitationsPath": "/api/admin/invitations",
    "AssignmentsPath": "/api/admin/assignments",
    "GlobalUsersPath": "/api/admin/users"
  }
}
```

**For local dev**: set `SupabaseJwtSecret` in `appsettings.Development.json` or user secrets:
```bash
dotnet user-secrets set "Auth:SupabaseJwtSecret" "<secret>"
dotnet user-secrets set "CrmData:BaseUrl" "http://localhost:8000"
```

### Running locally

```bash
cd crm-mvc
dotnet run
# → https://localhost:5001
```

### Production

- Transport: HTTPS only (enforced via `UseHsts` + `UseHttpsRedirection`)
- Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` flag added by middleware in prod
- Robots: `noindex, nofollow` in meta (admin CRM — not intended for search indexing)

---

## Migration Steps Summary

### Step 1 — Project Bootstrap
- .NET 8 MVC project scaffolded (`Vitaloop.Crm.Web`)
- Shared layouts: `_CommonMasterLayout`, `_CrmLayout`, `_BlankLayout`
- CSS/JS foundation: `vitaloop-theme.css`, `vitaloop-shell.css`, `app.js`

### Step 2 — Layout System
- Sidebar navigation, topbar with org switcher
- Shared partials: `_Breadcrumbs`, `_PageHeader`, `_StatCard`, `_EmptyState`, `_StatusPill`, `_FormSection`, `_FilterBar`
- Responsive layout for mobile with hamburger overlay

### Step 3 — Auth Layer
- JWT cookie extraction (`vo_access_token`) via custom `AuthenticationHandler`
- `IUserContextAccessor` — resolves user from token + `IUserContextDataSource`
- `IActiveOrganizationResolver` — resolves active org from `vo_active_org_id` cookie
- `IAccessPolicyService` — role-based access (`RequireOrgRole` action filter)
- `AuthStartupBlockersHostedService` — blocks startup if critical stubs detected
- `NullUserContextDataSource` — temporary stub, logs `CRITICAL` on every call

### Step 4 — CRM Domain Layer
- `ICrmDataGateway` → `HttpCrmDataGateway` (named HttpClient, timeout from config)
- Domain services: `OrganizationService`, `MembershipService`, `InvitationService`, `AssignmentService`
- All CRUD actions wired through domain services to FastAPI backend
- ViewModels for all list/detail/settings pages

### Step 5 — UI Polish
- CSS token expansion: semantic status tokens, typography scale, z-index stack
- Shell rebuild: sidebar gradient, topbar org switcher dropdown, toast notification system
- JS: mobile sidebar toggle, modal system, form loading states, danger confirm dialogs
- Quick Actions panels on Admin and Ops dashboards

### Step 6 — Cleanup & Final Handoff *(this step)*
- Removed all `Step 3`/`Step 4` placeholder text from views
- Auth views upgraded to `vo-field` structure with `for`/`id` pairing and `autocomplete`
- Org Settings form upgraded to `vo-field` with helper hints for disabled fields
- `_FormSection` partial stripped of hardcoded dummy fields (now header-only)
- `UserContextRecord.cs` TODO comment cleaned
- `NullUserContextDataSource` log message de-TODOed (kept `LogCritical` severity)
- `HomeController.Error` + `StatusCodeError` actions added
- `Program.cs`: `UseStatusCodePagesWithReExecute("/error/{0}")` + corrected error route
- `CrmDataOptions.TimeoutSeconds` wired to named HttpClient timeout
- `AuthController.SwitchOrganization` — org switching for any member (membership-checked)
- `wwwroot/favicon.svg` — SVG favicon with Vitaloop teal + "VL" mark
- `_CommonMasterLayout`: `<title>` dynamic with fallback, favicon link, `noindex` robots meta
- Error views: `Views/Home/Error.cshtml` (500) + `Views/Home/StatusCodeError.cshtml` (404/403/401/429)

---

## Known Limitations & Future Work

| Area | Current State | Next Step |
|------|--------------|-----------|
| `IUserContextDataSource` | `NullUserContextDataSource` (stub) — returns `null` on every call | Replace with Supabase/Postgres-backed implementation |
| Auth views (Login, ForgotPassword, ResetPassword) | UI shell only — `action="#"` | Wire to Supabase Auth REST or PKCE flow |
| Billing | UI shell only — Stripe data not fetched | Wire `BillingService` → Stripe SDK |
| Settings | Profile fields disabled | Wire `UserService` → Supabase user metadata |
| Org Settings (Billing/Support email) | Read-only stubs | Wire to billing provider and support config |
| `HttpCrmDataGateway` retry / circuit breaker | No retry policy | Add `Polly` via `AddPolicyHandler` |
| Structured logging | `Console` sink only | Add Serilog + structured sink (Seq, Datadog, etc.) |
| Integration tests | None | Add WebApplicationFactory test project |

---

## Key Architectural Decisions

1. **Org switch lives in `AuthController`**, not `OrganizationsController` — the latter has a class-level `[RequireOrgRole("org_owner","client_admin")]` filter that would block `end_user`/`practitioner` from switching. Any authenticated member can switch to any org they belong to.

2. **`NullUserContextDataSource` is intentionally loud** — `LogCritical` on every call ensures it's impossible to accidentally deploy this stub. `AuthStartupBlockersHostedService` also blocks startup when enabled.

3. **Cookie auth, not session** — JWT lives in `vo_access_token` (HttpOnly cookie), active org in `vo_active_org_id`. No server-side session state.

4. **`HttpCrmDataGateway` is the only external I/O point** — all domain services go through `ICrmDataGateway`. Swapping the backend (FastAPI → another service) requires only implementing `ICrmDataGateway`.

5. **`_BlankLayout` for error/auth pages** — avoids loading full shell (sidebar, topbar) when user may not be authenticated or org context is broken.

---

## Dependency List

| Package | Version | Purpose |
|---------|---------|---------|
| `Microsoft.AspNetCore.App` | .NET 8 framework | Core MVC, HttpClient, DI |
| `Microsoft.IdentityModel.Tokens` | 7.x | JWT validation |
| `System.IdentityModel.Tokens.Jwt` | 7.x | JWT parsing |

> All packages are part of the standard .NET 8 SDK — no third-party auth libraries or UI frameworks.
