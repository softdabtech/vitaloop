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

        // FIX: End-users or users with no CRM role should not be in CRM
        // Return error or redirect to frontend instead of defaulting to /admin
        if (!activeMembers.Any())
        {
            throw new InvalidOperationException(
                $"User {ctx.UserId} (role: {ctx.GlobalRole}) has no active CRM role memberships. " +
                "End-users should not access CRM - verify frontend post-login logic.");
        }

        return "/admin";
    }
}
