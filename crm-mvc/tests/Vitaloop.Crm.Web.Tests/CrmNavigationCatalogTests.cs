using System.Linq;
using Vitaloop.Crm.Web.Services.Navigation;
using Xunit;

namespace Vitaloop.Crm.Web.Tests;

public class CrmNavigationCatalogTests
{
    [Fact]
    public void Super_Admin_Sees_Ops_Items_But_Not_Org_Only_Items()
    {
        var superAdmin = TestUsers.SuperAdmin(null);
        var visible = CrmNavigationCatalog.GetVisibleGroups(superAdmin).SelectMany(g => g).ToList();

        Assert.Contains(visible, item => item.Href == "/ops");
        Assert.Contains(visible, item => item.Href == "/ops/knowledge-rules");
        // super_admin's ShouldShow short-circuit makes every item visible —
        // including org-console items — matching the pre-refactor behavior
        // (isSuperAdmin bypassed the whole role check in the old inline Razor logic too).
        Assert.Contains(visible, item => item.Href == "/admin");
    }

    [Fact]
    public void Org_Admin_Sees_Admin_Console_But_Not_Ops()
    {
        var orgId = Guid.NewGuid();
        var orgAdmin = TestUsers.OrgAdmin(orgId);
        var visible = CrmNavigationCatalog.GetVisibleGroups(orgAdmin).SelectMany(g => g).ToList();

        Assert.Contains(visible, item => item.Href == "/admin");
        Assert.Contains(visible, item => item.Href == "/admin/members");
        Assert.DoesNotContain(visible, item => item.Href == "/ops");
        Assert.DoesNotContain(visible, item => item.Href == "/ops/knowledge-rules");
    }

    [Fact]
    public void Practitioner_Sees_My_Clients_Not_Admin_Console()
    {
        var orgId = Guid.NewGuid();
        var practitioner = TestUsers.Practitioner(orgId, Guid.NewGuid());
        var visible = CrmNavigationCatalog.GetVisibleGroups(practitioner).SelectMany(g => g).ToList();

        Assert.Contains(visible, item => item.Href == "/practitioner/clients");
        Assert.DoesNotContain(visible, item => item.Href == "/admin");
        Assert.DoesNotContain(visible, item => item.Href == "/ops");
    }

    [Fact]
    public void Anonymous_User_Sees_Only_Roleless_Items()
    {
        var visible = CrmNavigationCatalog.GetVisibleGroups(null).SelectMany(g => g).ToList();

        Assert.Contains(visible, item => item.Href == "/settings");
        Assert.DoesNotContain(visible, item => item.Href == "/admin");
        Assert.DoesNotContain(visible, item => item.Href == "/ops");
    }

    [Fact]
    public void ResolveActiveHref_Prefers_Longest_Matching_Prefix()
    {
        var items = CrmNavigationCatalog.AllItems;
        var active = CrmNavigationCatalog.ResolveActiveHref(items, "/admin/members/invite");

        Assert.Equal("/admin/members/invite", active);
    }

    [Fact]
    public void Every_Nav_Item_Has_A_Non_Empty_Href_And_Label()
    {
        // Guards against copy-paste mistakes when a new item is added.
        foreach (var item in CrmNavigationCatalog.AllItems)
        {
            Assert.False(string.IsNullOrWhiteSpace(item.Href), "Href must not be empty");
            Assert.False(string.IsNullOrWhiteSpace(item.Label), $"Label must not be empty for {item.Href}");
            Assert.StartsWith("/", item.Href);
        }
    }
}
