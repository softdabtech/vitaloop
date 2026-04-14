using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Auth;

public sealed class AccessPolicyService : IAccessPolicyService
{
    public bool HasGlobalRole(UserContext userCtx, params string[] roles)
    {
        if (IsSuperAdmin(userCtx))
        {
            return true;
        }

        return roles.Any(r => string.Equals(userCtx.GlobalRole, r, StringComparison.OrdinalIgnoreCase));
    }

    public bool HasOrgRole(UserContext userCtx, Guid orgId, params string[] roles)
    {
        if (IsSuperAdmin(userCtx))
        {
            return true;
        }

        return userCtx.Memberships.Any(m =>
            m.OrganizationId == orgId &&
            string.Equals(m.Status, "active", StringComparison.OrdinalIgnoreCase) &&
            roles.Any(r => string.Equals(m.Role, r, StringComparison.OrdinalIgnoreCase)));
    }

    public bool HasAnyAdminRole(UserContext userCtx)
    {
        if (IsSuperAdmin(userCtx))
        {
            return true;
        }

        return userCtx.Memberships.Any(m =>
            string.Equals(m.Status, "active", StringComparison.OrdinalIgnoreCase) &&
            (string.Equals(m.Role, "org_owner", StringComparison.OrdinalIgnoreCase)
             || string.Equals(m.Role, "client_admin", StringComparison.OrdinalIgnoreCase)));
    }

    public bool IsSubscriptionActive(UserContext userCtx)
    {
        if (IsSuperAdmin(userCtx))
        {
            return true;
        }

        return userCtx.SubscriptionActive;
    }

    public bool CanAccessOrg(UserContext userCtx, Guid orgId)
    {
        if (IsSuperAdmin(userCtx))
        {
            return true;
        }

        return userCtx.Memberships.Any(m =>
            m.OrganizationId == orgId &&
            string.Equals(m.Status, "active", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsSuperAdmin(UserContext userCtx)
    {
        return string.Equals(userCtx.GlobalRole, "super_admin", StringComparison.OrdinalIgnoreCase);
    }
}
