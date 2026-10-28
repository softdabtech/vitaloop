# Stage 4 API Reference & Quick Start

## Backend Endpoints (FastAPI)

### Organizations

```bash
GET    /api/admin/organizations           # List accessible orgs
POST   /api/admin/organizations           # Create org (super_admin only)
GET    /api/admin/organizations/{id}      # Get org details
PATCH  /api/admin/organizations/{id}      # Update org (org admin only)
```

### Organization Members

```bash
GET    /api/admin/organizations/{id}/members
POST   /api/admin/organizations/{id}/members         # Add member
PATCH  /api/admin/organization-members/{id}         # Update role/status
```

### Practitioner Assignments

```bash
GET    /api/admin/organizations/{id}/assignments
POST   /api/admin/organizations/{id}/assignments      # Create assignment
PATCH  /api/admin/assignments/{id}                   # Update assignment
```

### Invitations

```bash
POST   /api/admin/organizations/{id}/invitations     # Send invite
GET    /api/admin/organizations/{id}/invitations     # List invitations
```

---

## Frontend Routes (ASP.NET MVC)

### Admin Area

```
/admin/organizations                    # Organizations grid
/admin/organizations/create             # Create org form
/admin/organizations/{id}               # Org details + members
/admin/members                          # Team members list
/admin/members/invite                   # Invite form
/admin/assignments                      # Assignments grid
/admin/assignments/create               # New assignment form
```

---

## Database Tables

| Table | Rows | Indexes | RLS |
|-------|------|---------|-----|
| organizations | Variable | owner_id, slug | ✅ |
| organization_members | Variable | org_id, user_id, role | ✅ |
| practitioner_assignments | Variable | org_id, practitioner_id, client_id | ✅ |
| invitations | Variable | org_id, email, token | ✅ |

---

## User Permissions Matrix

### Super Admin Features
- ✅ Create organizations
- ✅ View all organizations
- ✅ Access /ops dashboard
- ✅ View system admin overview

### Organization Admin Features  
- ✅ Add/remove team members
- ✅ Change member roles
- ✅ Create practitioner assignments
- ✅ Send team invitations
- ✅ View org details & settings

### Practitioner Features
- ✅ View assigned clients only
- ✅ Update client information
- ✅ See practitioner assignments
- ❌ Cannot create assignments
- ❌ Cannot invite members

### Regular Member Features
- ❌ No admin access
- ✅ View own profile
- ✅ Update own settings

---

## Configuration Keys

### Required Environment Variables

```bash
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
JWT_SECRET=[your-jwt-secret]
```

### CrmDataOptions (appsettings.json)

```json
{
  "CrmData": {
    "BaseUrl": "http://127.0.0.1:8004",
    "OrganizationsPath": "/api/admin/organizations",
    "MembersPath": "/api/admin/members",
    "InvitationsPath": "/api/admin/invitations",
    "AssignmentsPath": "/api/admin/assignments"
  }
}
```

---

## Role Values

### Global Roles
- `super_admin` — System administrator
- `client_admin` — Organization administrator  
- `end_user` — Regular user

### Organization Roles
- `org_owner` — Organization creator
- `client_admin` — Full admin access
- `manager` — Can manage assignments
- `practitioner` — Specialist/therapist
- `support` — Limited support access
- `member` — Basic member access

---

## Status Values

- `active` — Fully accessible
- `inactive` — Disabled but visible
- `pending` — Awaiting action (invitation)
- `removed` — Deleted/archived

---

## Quick Data Creation

### Create Organization
```json
POST /api/admin/organizations
{
  "name": "Acme Health",
  "slug": "acme-health",
  "owner_id": "user-uuid",
  "status": "active",
  "description": "Main clinic"
}
```

### Add Team Member  
```json
POST /api/admin/organizations/{org-id}/members
{
  "user_id": "user-uuid",
  "role": "practitioner",
  "status": "active"
}
```

### Create Assignment
```json
POST /api/admin/organizations/{org-id}/assignments
{
  "practitioner_id": "pract-uuid",
  "client_id": "client-uuid",
  "status": "active",
  "notes": "Primary care provider"
}
```

### Send Invitation
```json
POST /api/admin/organizations/{org-id}/invitations
{
  "email": "newmember@example.com",
  "role": "practitioner"
}
```

---

## Testing Commands

### Test Super Admin Access
```bash
curl -X GET https://crm.vitaloop.today/admin/organizations \
  -H "Authorization: Bearer [SUPER_ADMIN_JWT]"
```

### Test Org Admin Access
```bash
curl -X GET https://crm.vitaloop.today/admin/members \
  -H "Authorization: Bearer [ORG_ADMIN_JWT]"
```

### Test Practitioner Access (Should Fail)
```bash
curl -X POST https://crm.vitaloop.today/admin/organizations \
  -H "Authorization: Bearer [PRACTITIONER_JWT]" \
  -d '{...}'
# Expected: 403 Forbidden
```

---

## Performance Metrics

| Operation | Expected Time |
|-----------|---------------|
| List organizations (10) | < 50ms |
| Get org + members (5) | < 100ms |
| Create member | < 150ms |
| Create assignment | < 200ms |
| List assignments (100) | < 300ms |

---

## Compliance & Security

- ✅ Row-Level Security (RLS) enforced
- ✅ JWT validation on all endpoints
- ✅ Organization isolation verified
- ✅ Role-based access control (RBAC)
- ✅ Token expiration checking
- ✅ CORS properly configured

---

## Known Limitations

1. **Email Invitations**: Form exists, delivery not implemented
2. **Multi-org Dashboard**: Not yet aggregated
3. **Audit Logging**: Create-Update-Delete events not logged
4. **Subscription Blocking**: Inactive subscriptions not enforced via RLS

---

## Support & Troubleshooting

**Issues?** See [STAGE4-DEPLOYMENT.md](STAGE4-DEPLOYMENT.md) "Troubleshooting" section

**Questions?** Check [STAGE4-REPORT.md](STAGE4-REPORT.md) for detailed architecture
