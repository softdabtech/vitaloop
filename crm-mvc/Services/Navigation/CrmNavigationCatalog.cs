using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Models.Navigation;

namespace Vitaloop.Crm.Web.Services.Navigation;

/// <summary>
/// Single source of truth for the CRM's left sidebar — see CrmNavItem's
/// docstring for why this was extracted out of _Sidebar.cshtml.
///
/// Adding a page to the sidebar means adding one line to the list below.
/// Nothing else in the app should hardcode a second copy of this list or of
/// the visibility rule in ShouldShow(); Views/Shared/Partials/_Sidebar.cshtml
/// is a thin renderer over GetVisibleItems().
/// </summary>
public static class CrmNavigationCatalog
{
    public static readonly IReadOnlyList<CrmNavItem> AllItems = new[]
    {
        // Overview
        new CrmNavItem("/admin", "Dashboard", "Overview", "&#127968;", new[] { "org_admin", "manager" }),
        new CrmNavItem("/practitioner/clients", "My Clients", "Overview", "&#129658;", new[] { "practitioner" }),
        new CrmNavItem("/ops", "Ops", "Overview", "&#128202;", new[] { "super_admin" }),
        new CrmNavItem("/ops/activity", "Activity Log", "Overview", "&#129534;", new[] { "super_admin" }),
        new CrmNavItem("/ops/knowledge-rules", "Knowledge Rules", "Overview", "&#129516;", new[] { "super_admin" }),

        // CRM
        new CrmNavItem("/admin/organizations", "Organizations", "CRM", "&#127962;", new[] { "super_admin", "org_admin" }),
        new CrmNavItem("/admin/members", "Team Members", "CRM", "&#128101;", new[] { "org_admin", "manager" }),
        new CrmNavItem("/admin/members/invite", "Invitations", "CRM", "&#9993;", new[] { "org_admin" }),
        new CrmNavItem("/admin/assignments", "Assignments", "CRM", "&#128279;", new[] { "org_admin", "manager", "practitioner" }),

        // Account
        new CrmNavItem("/billing", "Billing", "Account", "&#128179;", new[] { "org_admin" }),
        new CrmNavItem("/settings", "Settings", "Account", "&#9881;", Array.Empty<string>()),
    };

    /// <summary>
    /// The same role-visibility rule _Sidebar.cshtml used to implement
    /// inline: super_admin sees everything; otherwise a role-keyword in an
    /// item's RequireRoles must be satisfied by the user's ACTIVE
    /// organization membership (org_admin covers org_owner/client_admin).
    /// An empty RequireRoles list means "visible to anyone signed in".
    /// </summary>
    public static bool ShouldShow(IReadOnlyList<string> requireRoles, UserContext? user)
    {
        if (requireRoles.Count == 0)
        {
            return true;
        }

        if (user is null)
        {
            return false;
        }

        var isSuperAdmin = string.Equals(user.GlobalRole, "super_admin", StringComparison.OrdinalIgnoreCase);
        if (isSuperAdmin)
        {
            return true;
        }

        var activeMembership = user.ActiveOrganizationId.HasValue
            ? user.Memberships.FirstOrDefault(m => m.OrganizationId == user.ActiveOrganizationId.Value)
            : null;

        var isOrgAdmin = activeMembership is not null
            && (string.Equals(activeMembership.Role, "org_owner", StringComparison.OrdinalIgnoreCase)
                || string.Equals(activeMembership.Role, "client_admin", StringComparison.OrdinalIgnoreCase));
        var isManager = activeMembership is not null
            && string.Equals(activeMembership.Role, "manager", StringComparison.OrdinalIgnoreCase);
        var isPractitioner = activeMembership is not null
            && string.Equals(activeMembership.Role, "practitioner", StringComparison.OrdinalIgnoreCase);

        return requireRoles.Any(role => role switch
        {
            "super_admin" => false, // already handled above; listed items requiring it only show for super_admin
            "org_admin" => isOrgAdmin,
            "manager" => isOrgAdmin || isManager,
            "practitioner" => isOrgAdmin || isManager || isPractitioner,
            _ => false,
        });
    }

    /// <summary>Visible items for this user, grouped in display order (Overview, CRM, Account, then anything else).</summary>
    public static IEnumerable<IGrouping<string, CrmNavItem>> GetVisibleGroups(UserContext? user)
    {
        return AllItems
            .Where(item => ShouldShow(item.RequireRoles, user))
            .GroupBy(item => item.Group)
            .OrderBy(group => group.Key switch
            {
                "Overview" => 0,
                "CRM" => 1,
                _ => 2,
            });
    }

    /// <summary>The visible item whose Href best matches the current request path (longest-prefix match), or null.</summary>
    public static string? ResolveActiveHref(IEnumerable<CrmNavItem> visibleItems, string currentPath)
    {
        return visibleItems
            .Where(item =>
                string.Equals(currentPath, item.Href, StringComparison.OrdinalIgnoreCase)
                || (item.Href.Length > 1 && currentPath.StartsWith(item.Href + "/", StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(item => item.Href.Length)
            .Select(item => item.Href)
            .FirstOrDefault();
    }
}
