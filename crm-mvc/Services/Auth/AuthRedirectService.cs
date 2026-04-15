using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Auth;

public sealed class AuthRedirectService
{
    public string ResolvePostLoginRedirect(UserContext ctx)
    {
        if (ctx.PendingInvite is not null)
        {
            return "/invitations/accept";
        }

        if (string.Equals(ctx.GlobalRole, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return "/ops";
        }

        var activeMembers = ctx.Memberships
            .Where(m => string.Equals(m.Status, "active", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var hasAdminRole = activeMembers.Any(m =>
            string.Equals(m.Role, "org_owner", StringComparison.OrdinalIgnoreCase)
            || string.Equals(m.Role, "client_admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(m.Role, "manager", StringComparison.OrdinalIgnoreCase));

        if (hasAdminRole)
        {
            return "/admin";
        }

        var hasPractitionerRole = activeMembers.Any(m =>
            string.Equals(m.Role, "practitioner", StringComparison.OrdinalIgnoreCase));

        if (hasPractitionerRole)
        {
            return "/practitioner/clients";
        }

        return "/admin";
    }
}
