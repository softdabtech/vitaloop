# Stage 4 Deployment & Configuration Guide

## Prerequisites

- Supabase project with auth.users table
- .NET 7+ runtime
- FastAPI 0.95+ with Pydantic
- Node.js 18+ for frontend
- Redis (optional, for caching tokens)

---

## 1. Database Setup (Supabase)

### Execute Migration

```bash
# Copy-paste the entire supabase_migrations.sql file
# Sections 15-18 (starting at line 359) into Supabase SQL Editor

# Sections to execute:
# 15. ORGANIZATIONS
# 16. ORGANIZATION MEMBERS
# 17. PRACTITIONER ASSIGNMENTS
# 18. INVITATIONS
```

### Verify RLS Policies

After migrations complete, verify RLS is enabled:

```sql
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN (
  'organizations', 'organization_members', 'practitioner_assignments', 'invitations'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

Expected output:
```
organizations | public | 16 kB
organization_members | public | 16 kB
practitioner_assignments | public | 8 kB
invitations | public | 8 kB
```

---

## 2. Backend Setup (FastAPI)

### Install Dependencies

```bash
cd /Users/oleksii/projects/vitaloop/backend

# Add to requirements.txt if not present:
# - pydantic>=0.95
# - uuid
# - python-dotenv

pip install -r requirements.txt
```

### Update .env

```bash
# Add/verify these variables:
export SUPABASE_URL="https://[your-project-id].supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="[your-service-role-key]"
export SUPABASE_ANON_KEY="[your-anon-key]"
export JWT_SECRET="[your-jwt-secret]"
```

### Test CRM Routes

```bash
# Start dev server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Test endpoint
curl -X GET http://localhost:8000/admin/organizations \
  -H "Authorization: Bearer [USER_JWT_TOKEN]"

# Expected: 200 OK with organization list (or empty if none exist)
```

---

## 3. CRM MVC Setup (.NET)

### Update appsettings.json

```json
{
  "CrmData": {
    "BaseUrl": "http://127.0.0.1:8004",
    "TimeoutSeconds": 30,
    "OrganizationsPath": "/api/admin/organizations",
    "MembersPath": "/api/admin/members",
    "InvitationsPath": "/api/admin/invitations",
    "AssignmentsPath": "/api/admin/assignments",
    "GlobalUsersPath": "/api/admin/users"
  },
  "Auth": {
    "Issuer": "https://[your-project-id].supabase.co/auth/v1",
    "Audience": "authenticated",
    "JwtPublicKey": "[your-ecdsa-public-key]"
  }
}
```

### Verify Services Registration

Check [Program.cs](Program.cs) includes:

```csharp
builder.Services.AddScoped<OrganizationService>();
builder.Services.AddScoped<MembershipService>();
builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<IAccessPolicyService, AccessPolicyService>();
builder.Services.AddScoped<IActiveOrganizationResolver, ActiveOrganizationResolver>();
```

### Build & Run

```bash
cd /Users/oleksii/projects/vitaloop/crm-mvc

dotnet build
dotnet run

# Navigate to: https://crm.vitaloop.today/admin/organizations
```

---

## 4. Frontend Setup (React/Vite)

### No Changes Required

The frontend SSO bridge (`frontend/src/auth/postLogin.js`) remains unchanged. Navigation uses standard CRM layout.

### Verify Sidebar Routes

Check that new routes are reachable:
- `/admin/organizations` → Organizations list
- `/admin/members` → Team members
- `/admin/assignments` → Practitioner assignments

---

## 5. Initial Data Setup

### Create Super Admin Organization

```bash
# As Super Admin, create first organization:
curl -X POST http://crm.vitaloop.today/api/admin/organizations \
  -H "Authorization: Bearer [SUPER_ADMIN_JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Organization",
    "slug": "test-org",
    "status": "active",
    "owner_id": "[owner-user-id]",
    "description": "Initial test organization"
  }'
```

### Add Team Member

```bash
curl -X POST http://crm.vitaloop.today/api/admin/organizations/[org-id]/members \
  -H "Authorization: Bearer [ORG_ADMIN_JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "[team-member-user-id]",
    "role": "practitioner",
    "status": "active"
  }'
```

### Create Assignment

```bash
curl -X POST http://crm.vitaloop.today/api/admin/organizations/[org-id]/assignments \
  -H "Authorization: Bearer [ORG_ADMIN_JWT]" \
  -H "Content-Type: application/json" \
  -d '{
    "practitioner_id": "[practitioner-id]",
    "client_id": "[client-id]",
    "status": "active",
    "notes": "Initial assignment"
  }'
```

---

## 6. Security Checklist

- [ ] All .env secrets in production are encrypted
- [ ] JWT public key correctly imported from Supabase
- [ ] RLS policies enforced in production (not bypassed)
- [ ] Organization IDs sanitized in all API calls
- [ ] Backend validates org_id before returning data
- [ ] Sidebar role-filtering doesn't leak data to UI
- [ ] Practitioner assignments strictly filtered by user_id

---

## 7. Monitoring & Logging

### Enable Request Logging

In [crm-mvc/appsettings.Production.json](crm-mvc/appsettings.Production.json):

```json
{
  "Logging": {
    "LogLevel": {
      "Microsoft.AspNetCore": "Warning",
      "Vitaloop.Crm.Web": "Information"
    }
  }
}
```

### Key Events to Log

- Organization creation
- Member role changes
- Assignment creation/deletion
- Failed authorization attempts
- Practitioner accessed other's clients (security incident)

---

## 8. Troubleshooting

### Issue: 403 Forbidden on organization access

**Cause**: User not in organization_members table or status != 'active'

**Fix**:
```sql
SELECT * FROM public.organization_members 
WHERE organization_id = '[org-id]' AND user_id = '[user-id]';

-- If empty, add:
INSERT INTO public.organization_members 
  (organization_id, user_id, role, status, joined_at)
VALUES ('[org-id]', '[user-id]', 'practitioner', 'active', NOW());
```

### Issue: Sidebar menu items not showing

**Cause**: Role not matching RequireOrgRole attribute

**Check**:
```csharp
var userCtx = await _userContextAccessor.GetCurrent();
Console.WriteLine($"Role: {userCtx?.Memberships.FirstOrDefault()?.Role}");
Console.WriteLine($"ActiveOrg: {userCtx?.ActiveOrganizationId}");
```

### Issue: Backend returns 500 on /admin/organizations

**Cause**: Database connection or missing RLS policies

**Fix**:
```bash
# Test Supabase connection
curl -X GET "https://[project].supabase.co/rest/v1/organizations?select=*&limit=1" \
  -H "apikey: [your-anon-key]" \
  -H "Authorization: Bearer [token]"

# Check RLS policy
SELECT polname, qual FROM pg_policies WHERE tablename = 'organizations';
```

---

## 9. Performance Optimization (Optional)

### Add Indexes

```sql
CREATE INDEX idx_org_members_org_status ON organization_members(organization_id, status);
CREATE INDEX idx_org_members_user_role ON organization_members(user_id, role);
CREATE INDEX idx_assignments_practitioner ON practitioner_assignments(practitioner_id, status);
```

### Cache Organization List

In [OrganizationService.cs](Services/Organizations/OrganizationService.cs):

```csharp
private static readonly MemoryCache _orgCache = new();
private const string OrgCacheKey = "orgs_{orgId}";

public async Task<Organization?> GetOrganization(UserContext userCtx, Guid orgId, CancellationToken ct = default)
{
    var cacheKey = $"{OrgCacheKey}_{orgId}";
    if (_orgCache.TryGetValue(cacheKey, out var cached))
        return cached as Organization;
    
    var org = await _gateway.GetOrganization(orgId, ct);
    _orgCache.Set(cacheKey, org, TimeSpan.FromMinutes(5));
    return org;
}
```

---

## 10. Next Steps

After successful deployment:

1. **Quality Assurance**: Run all tests from [STAGE4-REPORT.md](STAGE4-REPORT.md) section F
2. **User Acceptance Testing**: Have stakeholders verify UI/UX
3. **Load Testing**: Test with 100+ organizations & 1000+ members
4. **Security Audit**: Review RLS policies & access controls with security team
5. **Release**: Tag version (e.g., v1.4.0) and deploy to prod

**Estimated QA Duration**: 2-3 days  
**Estimated Load Test Duration**: 1 day  
**Estimated Security Review**: 2-4 hours
