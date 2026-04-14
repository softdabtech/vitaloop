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

        if (!ctx.OnboardingCompleted)
        {
            return "/onboarding";
        }

        if (string.Equals(ctx.GlobalRole, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return "/ops";
        }

        var hasOrgAdminRole = ctx.Memberships.Any(m =>
            string.Equals(m.Status, "active", StringComparison.OrdinalIgnoreCase) &&
            (string.Equals(m.Role, "org_owner", StringComparison.OrdinalIgnoreCase)
             || string.Equals(m.Role, "client_admin", StringComparison.OrdinalIgnoreCase)));

        if (hasOrgAdminRole)
        {
            return "/admin";
        }

        return "/dashboard";
    }
}
