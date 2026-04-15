# Stage 4 — CRM Core: Organizations, Memberships, Multi-tenancy

## QA & Implementation Report
**Date:** April 15, 2026  
**Status:** Ready for Testing  
**Scope:** Complete multi-tenancy infrastructure, role-based access, SSO integration

---

## A. Entity & Relationship List

### 1. Database Tables (Supabase)

| Entity | Fields | Purpose | RLS Enabled |
|--------|--------|---------|-------------|
| **organizations** | id, name, slug, status, owner_id, owner_name, logo_url, description, metadata, created_at, updated_at | Store CRM organizations | ✅ Yes |
| **organization_members** | id, organization_id, user_id, role, status, invited_by, invited_at, joined_at, updated_at | Many-to-many members with roles | ✅ Yes |
| **practitioner_assignments** | id, organization_id, practitioner_id, client_id, status, notes, assigned_at, updated_at | Link practitioners to clients | ✅ Yes |
| **invitations** | id, organization_id, email, role, status, invited_by, token, expires_at, created_at | Pending user invites | ✅ Yes |

### 2. Entity Relationships

```
users (auth.users)
  ├── organizations (owner_id FK)
  ├── organization_members (user_id FK)
  │   ├── roles: org_owner, client_admin, manager, practitioner, support, member
  │   └── status: active, inactive, pending, removed
  └── practitioner_assignments
      ├── As practitioner_id (specialist)
      └── As client_id (patient/end-user)

organizations
  ├── organization_members (many-to-many)
  ├── practitioner_assignments
  └── invitations
```

### 3. .NET Models (C#)

- **Organization.cs**: Name, Slug, Status, OwnerName, CreatedAt, UpdatedAt
- **OrganizationSettings.cs**: TimeZone, BillingEmail, SupportEmail, IsLocked
- **Member.cs**: UserId, Email, FullName, GlobalRole, OrgRole, MembershipStatus, SubscriptionStatus
- **Assignment.cs**: ClientId, ClientName, PractitionerId, PractitionerName, Status
- **Invitation.cs**: Email, Role, Status, ExpiresAt, CreatedAt
- **UserContext.cs**: Enhanced with ActiveOrganizationId, Memberships[], PendingInvite

### 4. ViewModels (RazorPages)

- **OrganizationViewModel**: Display org with role label & status badge
- **OrganizationsPageViewModel**: List grid with admin controls
- **OrganizationDetailViewModel**: Org details + members tab
- **MembersPageViewModel**: Team roster with stats (practitioners count)
- **MemberViewModel**: Individual member card (role, status, subscription)
- **AssignmentViewModel**: Practitioner → Client display
- **AssignmentsPageViewModel**: Assignment grid

---

## B. Multi-tenancy Enforcement Schema

### 1. Database-Level (Supabase RLS)

**organization_members table:**
```sql
-- Users see only their memberships
CREATE POLICY "OrgMembers: see own membership" 
  USING (auth.uid() = user_id);

-- Admins see org members
CREATE POLICY "OrgMembers: admins see org members" 
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('org_owner', 'client_admin')
    )
  );
```

**practitioner_assignments table:**
```sql
-- Users see assignments involving them
CREATE POLICY "PractitionerAssignments: users see assignments involving them" 
  USING (auth.uid() = practitioner_id OR auth.uid() = client_id);

-- Admins see org assignments
CREATE POLICY "PractitionerAssignments: admins see org assignments" 
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('org_owner', 'client_admin', 'manager')
    )
  );
```

### 2. Application-Level (CRM MVC)

**AccessPolicyService.cs:**
```csharp
// Enforce by global role (super_admin sees all)
HasGlobalRole(userCtx, "super_admin") → unrestricted

// Enforce by org membership
CanAccessOrg(userCtx, orgId) 
  → userCtx.Memberships.Any(m => m.OrganizationId == orgId && m.Status == "active")

// Enforce by org role (within specific org)
HasOrgRole(userCtx, orgId, "org_owner", "client_admin")
  → check membership.Role in specified list
```

**Controller Authorization:**
```csharp
[RequireGlobalRole("super_admin")]  // Only Super Admins
public class ManageAllOrgsController { }

[RequireOrgRole("org_owner", "client_admin")]  // Org Admins only
public class ManageMembersController { }

[RequireOrgRole("practitioner")]  // Practitioners see own clients
public class MyClientsController { }
```

### 3. API Gateway (HttpCrmDataGateway)

- Includes JWT token from auth context in all requests
- Backend validates token.sub against org membership
- Backend returns 403 if user.org_id not in {org_id parameter}

### 4. Backend Enforcement (FastAPI)

**CRM Router (/admin/... endpoints):**
```python
# All endpoints verify org membership before querying
member = sb.table("organization_members")
  .select("*")
  .eq("organization_id", str(org_id))
  .eq("user_id", current_user["sub"])
  .execute()

if not member.data:
  raise HTTPException(403, "Access denied")
```

---

## C. Role Implementation Status

### 1. Global Roles

| Role | Super Admin | View | Create | Edit | Delete |
|------|:----------:|:----:|:------:|:----:|:------:|
| **super_admin** | ✅ | All Orgs | ✅ Org | ✅ Org | ❌ |
| **client_admin** | ❌ | Own Org | ❌ | ✅ Org Settings | ❌ |
| **end_user** | ❌ | None | ❌ | ❌ | ❌ |

### 2. Organization Roles

| Role | Ops | Members | Roles | Assign | Invite | Clients |
|------|:---:|:-------:|:-----:|:------:|:------:|:-------:|
| **org_owner** | ✅ | ✅ | ✅ Change | ✅ | ✅ | ✅ Full |
| **client_admin** | ✅ | ✅ | ✅ Change | ✅ | ✅ | ✅ Full |
| **manager** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ Full |
| **practitioner** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Own |
| **support** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Assigned |
| **member** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 3. Practitioner-Specific Permissions

```javascript
Practitioner Dashboard Logic:
├─ Client View: Shows ONLY clients assigned to this practitioner
├─ Client Edit: Can update client data, notes, protocol
├─ Visibility: Cannot see other practitioners' clients (even same org)
├─ Assignment: Cannot reassign own clients
└─ Multi-org: If assigned to Practitioner role in multiple orgs,
   dashboard filters clients per active org context
```

### 4. Access Verification Path

```
Request → AuthController (JWT validation)
  ↓
UserContextAccessor (load memberships from /auth/me)
  ↓
RequireOrgRole attribute (verify org role present & active)
  ↓
Controller method (additional business logic checks)
  ↓
Service layer (IAccessPolicyService enforces rules)
  ↓
Data gateway (passes org_id filter to backend)
  ↓
Backend (RLS policies + explicit org_id check)
  ↓
Response with org-filtered data (or 403)
```

---

## D. UI & Layout Changes

### 1. Updated Sidebar (_Sidebar.cshtml)

**Before:**
- Static menu items (all shown to all users)
- Global role display only
- No organization selector

**After:**
```
Identity Block:
├─ Email
├─ Role (e.g., "🔑 Super Admin" or "org_owner")
└─ Organization Selector (dropdown if user in multiple orgs)
    └─ Orgs can switch context on-the-fly

Nav Items (Role-Filtered):
├─ Overview
│  ├─ Dashboard ✅ (all)
│  └─ Ops 🔐 (super_admin only)
├─ CRM
│  ├─ Organizations 🔐 (super_admin, org_admin)
│  ├─ Team Members 🔐 (org_admin, manager)
│  ├─ Invitations 🔐 (org_admin)
│  └─ Assignments 🔐 (org_admin, manager, practitioner)
└─ Account
   ├─ Billing 🔐 (org_admin)
   └─ Settings ✅ (all)
```

### 2. New Pages

| Page | Route | Access | Purpose |
|------|-------|--------|---------|
| Organizations List | `/admin/organizations` | super_admin, client_admin | Grid view of all/accessible orgs |
| Organization Details | `/admin/organizations/{id}` | super_admin, org members | Org details + members tab |
| Create Organization | `/admin/organizations/create` | super_admin | Form to create new org |
| Team Members | `/admin/members` | org_admin, managers | List + stats (practitioners count) |
| Invite Member | `/admin/members/invite` | org_admin | Form to send email invite |
| Practitioner Assignments | `/admin/assignments` | org_admin, managers, practitioners | Grid of assignments |
| Create Assignment | `/admin/assignments/create` | org_admin, managers | Link client to practitioner |

### 3. Updated Pages

| Page | Changes |
|------|---------|
| Auth/PostLogin | **No changes** — SSO bridge maintains compatibility |
| Dashboard (Ops) | **No changes** — Super Admin view unchanged |
| Admin Dashboard | **New**: Org selector for context switching |
| User Profile | **Planned**: Show active org, role, permissions |

### 4. Components & Styles

**New Classes:**
```css
.vo-org-selector       /* Dropdown in identity block */
.vo-org-select        /* Select element styling */
.page-header          /* Flex container for title + actions */
.stats-row            /* Grid for stat cards (members, practitioners) */
.badge-*              /* Status badges (active, inactive, role colors) */
.table-responsive     /* Scrollable table wrapper */
.empty-state          /* Centered placeholder when no data */
```

---

## E. Implementation Files & Line References

### Backend (FastAPI)

| File | Changes |
|------|---------|
| [app/models/organization.py](app/models/organization.py) | New models: Organization, OrganizationCreate, OrganizationDetail |
| [app/models/crm.py](app/models/crm.py) | New models: OrganizationMember, PractitionerAssignment, Invitation |
| [app/routers/crm.py](app/routers/crm.py) | NEW router: 15+ endpoints for org CRUD, member mgmt, assignments |
| [app/main.py](app/main.py) | Line 10: Added `crm` import; Line 35: Register `app.include_router(crm.router, prefix="/admin")` |

### Frontend (CRM MVC)

**Models:**
| File | Lines | Change |
|------|-------|--------|
| [Models/Crm/Organization.cs](Models/Crm/Organization.cs) | 1-24 | No change (already exists) |
| [Models/Crm/Member.cs](Models/Crm/Member.cs) | 1-28 | No change (already exists) |
| [Models/Crm/Assignment.cs](Models/Crm/Assignment.cs) | 1-14 | No change (already exists) |

**ViewModels:**
| File | Lines | Change |
|------|-------|--------|
| [ViewModels/OrganizationsPageViewModel.cs](ViewModels/OrganizationsPageViewModel.cs) | NEW | 3 new VMs: OrganizationsPageViewModel, OrganizationDetailViewModel, CreateOrganizationViewModel |
| [ViewModels/MembersPageViewModel.cs](ViewModels/MembersPageViewModel.cs) | 1-11 | No change (already exists) |

**Controllers:**
| File | Lines | Change |
|------|-------|--------|
| [Areas/Admin/Controllers/OrganizationsController.cs](Areas/Admin/Controllers/OrganizationsController.cs) | NEW | NEW controller: Index, Create, Details, UpdateStatus (72 lines) |
| [Areas/Admin/Controllers/UsersController.cs](Areas/Admin/Controllers/UsersController.cs) | NEW | NEW controller: Team members, Invite, ChangeRole, RemoveMember (121 lines) |
| [Areas/Admin/Controllers/AssignmentsController.cs](Areas/Admin/Controllers/AssignmentsController.cs) | NEW | NEW controller: Index, Create, Reassign (139 lines) |

**Views:**
| File | Change |
|------|--------|
| [Areas/Admin/Views/Organizations/Index.cshtml](Areas/Admin/Views/Organizations/Index.cshtml) | NEW: Organizations grid view |
| [Areas/Admin/Views/Organizations/Create.cshtml](Areas/Admin/Views/Organizations/Create.cshtml) | NEW: Org creation form |
| [Areas/Admin/Views/Organizations/Details.cshtml](Areas/Admin/Views/Organizations/Details.cshtml) | NEW: Org details + members table |
| [Areas/Admin/Views/Users/Index.cshtml](Areas/Admin/Views/Users/Index.cshtml) | NEW: Team members list with stats |
| [Areas/Admin/Views/Assignments/Index.cshtml](Areas/Admin/Views/Assignments/Index.cshtml) | NEW: Assignments grid view |
| [Views/Shared/Partials/_Sidebar.cshtml](Views/Shared/Partials/_Sidebar.cshtml) | Line 1-120: Major refactor — role-based nav filtering + org selector |

**Services:**
| File | Lines | Change |
|------|-------|--------|
| [Services/Organizations/OrganizationService.cs](Services/Organizations/OrganizationService.cs) | 55-62 | Added GetMembers method |
| [Services/Memberships/MembershipService.cs](Services/Memberships/MembershipService.cs) | 1-59 | No change (already exists) |
| [Services/Assignments/AssignmentService.cs](Services/Assignments/AssignmentService.cs) | 1-45 | No change (already exists) |

**Attributes:**
| File | Status |
|------|--------|
| [Attributes/RequireGlobalRoleAttribute.cs](Attributes/RequireGlobalRoleAttribute.cs) | No change (already exists) |
| [Attributes/RequireOrgRoleAttribute.cs](Attributes/RequireOrgRoleAttribute.cs) | No change (already exists) |

---

## F. Testing Checklist

### Multi-tenancy Isolation

- [ ] **Test 1**: Super Admin creates Org A (user1 is owner) → User1 can access
- [ ] **Test 2**: Super Admin creates Org B (user2 is owner) → User1 cannot access
- [ ] **Test 3**: User1 (Org A admin) adds User3 as practitioner → User3 sees Org A only
- [ ] **Test 4**: User1 tries direct URL to Org B dashboard → 403 Forbidden
- [ ] **Test 5**: Practitioner assigned Client A → Cannot see Client B (diff practitioner)
- [ ] **Test 6**: Backend /admin/assignments/create with wrong org_id → 403 rejected

### Role-Based Access

- [ ] **Test 7**: Super Admin sees /ops dashboard
- [ ] **Test 8**: Client Admin cannot access /ops → redirected/hidden
- [ ] **Test 9**: Practitioner sidebar shows only Assignments (not Organizations)
- [ ] **Test 10**: Org admin can create invite → Invite link sends email
- [ ] **Test 11**: Practitioner cannot create assignment → 403 or form hidden
- [ ] **Test 12**: Member cannot change own role → denied

### UI/UX

- [ ] **Test 13**: Sidebar organization dropdown switches context
- [ ] **Test 14**: Organization selector shows only accessible orgs
- [ ] **Test 15**: Role displayed in identity block (e.g., "org_owner")
- [ ] **Test 16**: Empty state shows when no organizations/members
- [ ] **Test 17**: Breadcrumbs reflect active organization

### Data Isolation

- [ ] **Test 18**: Backend query org members → only active members returned
- [ ] **Test 19**: Practitioner dashboard query assignments → own clients only
- [ ] **Test 20**: Member count correct per org (not leaked from other orgs)

---

## G. Known Limitations & Next Steps

### Current Limitations

1. **Invitation Flow**: UI form created, backend email sending not yet implemented
2. **Practitioner Dashboard**: Assignment filtering logic complete, UI dashboard view not yet created
3. **Multi-org Practitioners**: Logic assumes 1 primary org context; switching logic in sidebar works
4. **Subscription Enforcement**: RLS policies don't yet block inactive subscriptions (can add)
5. **Audit Logging**: No logs of role changes, invitations sent — recommended for compliance

### Recommended Next Steps

1. **Phase 5a**: Implement invitation email sending (SendGrid or similar)
2. **Phase 5b**: Build Practitioner dashboard UI showing only assigned clients
3. **Phase 5c**: Add multi-org dashboard aggregator (Super Admin view all orgs stats)
4. **Phase 5d**: Implement organization settings (billing, webhooks, SSO config)
5. **Phase 5e**: Add audit log table + endpoint for compliance tracking

---

## Summary

✅ **Organizations CRUD**: Full management for Super Admins & org owners  
✅ **Multi-tenancy Enforcement**: 3-layer security (DB RLS, app policy, backend check)  
✅ **Role-Based Access**: 6 org roles + 3 global roles with granular permissions  
✅ **UI/Sidebar**: Dynamic nav filtering + org context switching  
⚠️ **Email Invitations**: UI ready, backend delivery pending  
⚠️ **Practitioner Dashboard**: Logic ready, UI pending  

**Status**: Ready for QA Testing & Iteration
