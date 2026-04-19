using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Auth;
using Vitaloop.Crm.Web.Services.Memberships;

namespace Vitaloop.Crm.Web.Tests;

public class AdminDependencyTests
{
    [Fact]
    public void AccessPolicy_SuperAdmin_Has_Global_And_Org_Access()
    {
        var orgId = Guid.NewGuid();
        var service = new AccessPolicyService();
        var user = new UserContext
        {
            UserId = Guid.NewGuid(),
            Email = "bombela1988@gmail.com",
            GlobalRole = "super_admin",
            ActiveOrganizationId = orgId,
            SubscriptionActive = false,
            SubscriptionStatus = "inactive",
            Memberships = Array.Empty<Membership>()
        };

        Assert.True(service.HasGlobalRole(user, "super_admin"));
        Assert.True(service.HasOrgRole(user, orgId, "org_owner"));
        Assert.True(service.CanAccessOrg(user, orgId));
        Assert.True(service.IsSubscriptionActive(user));
    }

    [Fact]
    public void AccessPolicy_Requires_Active_Membership_For_Org_Access()
    {
        var orgId = Guid.NewGuid();
        var service = new AccessPolicyService();
        var user = new UserContext
        {
            UserId = Guid.NewGuid(),
            Email = "user@vitaloop.today",
            GlobalRole = "end_user",
            ActiveOrganizationId = orgId,
            SubscriptionActive = true,
            SubscriptionStatus = "active",
            Memberships =
            [
                new Membership { OrganizationId = orgId, Role = "client_admin", Status = "removed" }
            ]
        };

        Assert.False(service.HasOrgRole(user, orgId, "client_admin"));
        Assert.False(service.CanAccessOrg(user, orgId));
    }

    [Fact]
    public void AuthRedirect_Admin_Roles_Go_To_Admin_Cabinet()
    {
        var orgId = Guid.NewGuid();
        var redirect = new AuthRedirectService();

        var user = new UserContext
        {
            UserId = Guid.NewGuid(),
            Email = "admin@vitaloop.today",
            GlobalRole = "end_user",
            ActiveOrganizationId = orgId,
            SubscriptionActive = true,
            SubscriptionStatus = "active",
            Memberships =
            [
                new Membership { OrganizationId = orgId, Role = "manager", Status = "active" }
            ]
        };

        var path = redirect.ResolvePostLoginRedirect(user);

        Assert.Equal("/admin", path);
    }

    [Fact]
    public async Task MembershipService_Filters_Removed_Members_For_UserCabinet_Consistency()
    {
        var orgId = Guid.NewGuid();
        var policy = new FakeAccessPolicyService { CanAccessOrgResult = true };
        var gateway = new FakeCrmDataGateway
        {
            Members =
            [
                new Member { UserId = Guid.NewGuid(), Email = "active@vitaloop.today", FullName = "Active", OrgRole = "practitioner", MembershipStatus = "active" },
                new Member { UserId = Guid.NewGuid(), Email = "removed@vitaloop.today", FullName = "Removed", OrgRole = "practitioner", MembershipStatus = "removed" }
            ]
        };

        var user = TestUsers.OrgAdmin(orgId);
        var service = new MembershipService(gateway, policy);

        var members = await service.GetMembers(user, orgId, CancellationToken.None);

        Assert.Single(members);
        Assert.Equal("active@vitaloop.today", members[0].Email);
    }

    [Fact]
    public async Task MembershipService_RuntimeReadiness_Only_For_SuperAdmin()
    {
        var policy = new FakeAccessPolicyService { HasGlobalRoleResult = false };
        var gateway = new FakeCrmDataGateway();
        var service = new MembershipService(gateway, policy);
        var user = TestUsers.OrgAdmin(Guid.NewGuid());

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetRuntimeReadiness(user, CancellationToken.None));
    }
}
