using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.Extensions.Logging.Abstractions;
using Vitaloop.Crm.Web.Areas.Admin.Controllers;
using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Invitations;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Tests;

public class AdminControllersTests
{
    [Fact]
    public async Task Dashboard_Index_Returns_View()
    {
        var controller = new DashboardController();

        var result = controller.Index();

        Assert.IsType<ViewResult>(result);
    }

    [Fact]
    public async Task Organizations_Index_Maps_Model_And_Kpis()
    {
        var orgId = Guid.NewGuid();
        var userCtx = TestUsers.SuperAdmin(orgId);
        var gateway = new FakeCrmDataGateway
        {
            Organizations =
            [
                new Organization { Id = orgId, Name = "Vitaloop", Slug = "vitaloop", Status = "active", OwnerName = "Owner" }
            ]
        };

        var controller = CreateOrganizationsController(userCtx, gateway, canAccessOrg: true, hasGlobalSuperAdmin: true, hasOrgAdmin: true);

        var action = await controller.Index(CancellationToken.None);

        var view = Assert.IsType<ViewResult>(action);
        var model = Assert.IsType<OrganizationsPageViewModel>(view.Model);
        Assert.True(model.IsSuperAdmin);
        Assert.Equal(1, model.TotalOrganizations);
        Assert.Equal("/admin/organizations/create", model.CreateOrgUrl);
    }

    [Fact]
    public async Task Organizations_Create_Get_NonSuperAdmin_Redirects()
    {
        var userCtx = TestUsers.OrgAdmin(Guid.NewGuid());
        var gateway = new FakeCrmDataGateway();
        var controller = CreateOrganizationsController(userCtx, gateway, canAccessOrg: true, hasGlobalSuperAdmin: false, hasOrgAdmin: true);

        var action = await controller.Create(CancellationToken.None);

        var redirect = Assert.IsType<RedirectToActionResult>(action);
        Assert.Equal("Index", redirect.ActionName);
    }

    [Fact]
    public async Task Organizations_Details_Computes_Member_Indicators()
    {
        var orgId = Guid.NewGuid();
        var userCtx = TestUsers.SuperAdmin(orgId);
        var gateway = new FakeCrmDataGateway
        {
            OneOrganization = new Organization { Id = orgId, Name = "Org", Slug = "org", Status = "active", OwnerName = "Owner" },
            Members =
            [
                new Member { UserId = Guid.NewGuid(), FullName = "P1", Email = "p1@vitaloop.today", OrgRole = "practitioner", MembershipStatus = "active" },
                new Member { UserId = Guid.NewGuid(), FullName = "A1", Email = "a1@vitaloop.today", OrgRole = "client_admin", MembershipStatus = "active" }
            ]
        };

        var controller = CreateOrganizationsController(userCtx, gateway, canAccessOrg: true, hasGlobalSuperAdmin: true, hasOrgAdmin: true);

        var action = await controller.Details(orgId, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(action);
        var model = Assert.IsType<OrganizationDetailViewModel>(view.Model);
        Assert.Equal(2, model.MemberCount);
        Assert.Equal(1, model.PractitionerCount);
    }

    [Fact]
    public async Task Organizations_UpdateStatus_NoOrgPermission_Returns_Forbid()
    {
        var orgId = Guid.NewGuid();
        var userCtx = TestUsers.SuperAdmin(orgId);
        var gateway = new FakeCrmDataGateway();
        var controller = CreateOrganizationsController(userCtx, gateway, canAccessOrg: true, hasGlobalSuperAdmin: true, hasOrgAdmin: false);

        var action = await controller.UpdateStatus(orgId, "suspended", CancellationToken.None);

        Assert.IsType<ForbidResult>(action);
    }

    [Fact]
    public async Task Organizations_Switch_With_Local_ReturnUrl_Redirects_To_It()
    {
        var orgId = Guid.NewGuid();
        var userCtx = TestUsers.SuperAdmin(orgId);
        var gateway = new FakeCrmDataGateway();
        var controller = CreateOrganizationsController(userCtx, gateway, canAccessOrg: true, hasGlobalSuperAdmin: true, hasOrgAdmin: true);

        var action = await controller.Switch(orgId, "/admin/members", CancellationToken.None);

        var redirect = Assert.IsType<RedirectResult>(action);
        Assert.Equal("/admin/members", redirect.Url);
    }

    [Fact]
    public async Task Users_Index_Without_Active_Org_Redirects_To_Organizations()
    {
        var userCtx = TestUsers.SuperAdmin(null);
        var gateway = new FakeCrmDataGateway();
        var controller = CreateUsersController(userCtx, gateway, canAccessOrg: true, hasOrgAdmin: true);

        var action = await controller.Index(CancellationToken.None);

        var redirect = Assert.IsType<RedirectToActionResult>(action);
        Assert.Equal("Index", redirect.ActionName);
        Assert.Equal("Organizations", redirect.ControllerName);
    }

    [Fact]
    public async Task Users_Index_Returns_Kpis_Total_And_Practitioner_Count()
    {
        var orgId = Guid.NewGuid();
        var userCtx = TestUsers.OrgAdmin(orgId);
        var gateway = new FakeCrmDataGateway
        {
            Members =
            [
                new Member { UserId = Guid.NewGuid(), OrgRole = "practitioner", MembershipStatus = "active", Email = "p@vitaloop.today", FullName = "P" },
                new Member { UserId = Guid.NewGuid(), OrgRole = "manager", MembershipStatus = "active", Email = "m@vitaloop.today", FullName = "M" }
            ]
        };

        var controller = CreateUsersController(userCtx, gateway, canAccessOrg: true, hasOrgAdmin: true);

        var action = await controller.Index(CancellationToken.None);

        var view = Assert.IsType<ViewResult>(action);
        var model = Assert.IsType<MembersPageViewModel>(view.Model);
        Assert.Equal(2, model.TotalMembers);
        Assert.Equal(1, model.PractitionerCount);
    }

    [Fact]
    public async Task Users_ChangeRole_Without_ActiveOrg_Returns_BadRequest()
    {
        var userCtx = TestUsers.OrgAdmin(null);
        var gateway = new FakeCrmDataGateway();
        var controller = CreateUsersController(userCtx, gateway, canAccessOrg: true, hasOrgAdmin: true);

        var action = await controller.ChangeRole(Guid.NewGuid(), "manager", CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(action);
    }

    [Fact]
    public async Task Users_SendInvite_Success_Redirects_To_Index()
    {
        var orgId = Guid.NewGuid();
        var userCtx = TestUsers.OrgAdmin(orgId);
        var gateway = new FakeCrmDataGateway();
        var controller = CreateUsersController(userCtx, gateway, canAccessOrg: true, hasOrgAdmin: true);

        var action = await controller.SendInvite(new InvitationViewModel
        {
            Email = "bombela1988@gmail.com",
            Role = "client_admin",
            OrganizationId = orgId
        }, CancellationToken.None);

        var redirect = Assert.IsType<RedirectToActionResult>(action);
        Assert.Equal("Index", redirect.ActionName);
        Assert.Equal("bombela1988@gmail.com", gateway.LastInviteEmail);
    }

    [Fact]
    public async Task Assignments_Index_Practitioner_Sees_Only_Own_Cases()
    {
        var orgId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var userCtx = TestUsers.Practitioner(orgId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            Assignments =
            [
                new Assignment { Id = Guid.NewGuid(), OrganizationId = orgId, ClientId = Guid.NewGuid(), PractitionerId = practitionerId, ClientName = "Client A", PractitionerName = "Me", UpdatedAt = DateTimeOffset.UtcNow },
                new Assignment { Id = Guid.NewGuid(), OrganizationId = orgId, ClientId = Guid.NewGuid(), PractitionerId = Guid.NewGuid(), ClientName = "Client B", PractitionerName = "Other", UpdatedAt = DateTimeOffset.UtcNow }
            ]
        };

        var controller = CreateAssignmentsController(userCtx, gateway, hasGlobalSuperAdmin: false, hasOrgAdmin: false, hasPractitionerRole: true, canAccessOrg: true);

        var action = await controller.Index(CancellationToken.None);

        var view = Assert.IsType<ViewResult>(action);
        var model = Assert.IsType<AssignmentsPageViewModel>(view.Model);
        Assert.Single(model.Assignments);
        Assert.Equal(practitionerId, model.Assignments[0].PractitionerId);
    }

    [Fact]
    public async Task Assignments_Create_With_Empty_Ids_Returns_Model_Error()
    {
        var orgId = Guid.NewGuid();
        var userCtx = TestUsers.OrgAdmin(orgId);
        var gateway = new FakeCrmDataGateway();
        var controller = CreateAssignmentsController(userCtx, gateway, hasGlobalSuperAdmin: false, hasOrgAdmin: true, hasPractitionerRole: false, canAccessOrg: true);

        var action = await controller.Create(new CreateAssignmentViewModel
        {
            OrganizationId = orgId,
            ClientId = Guid.Empty,
            PractitionerId = Guid.Empty
        }, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(action);
        Assert.False(controller.ModelState.IsValid);
        Assert.Contains(controller.ModelState, kv => kv.Value?.Errors.Any(e => e.ErrorMessage.Contains("required", StringComparison.OrdinalIgnoreCase)) == true);
    }

    [Fact]
    public async Task Assignments_Reassign_Without_ActiveOrg_Returns_BadRequest()
    {
        var userCtx = TestUsers.OrgAdmin(null);
        var gateway = new FakeCrmDataGateway();
        var controller = CreateAssignmentsController(userCtx, gateway, hasGlobalSuperAdmin: false, hasOrgAdmin: true, hasPractitionerRole: false, canAccessOrg: true);

        var action = await controller.Reassign(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(action);
    }

    private static OrganizationsController CreateOrganizationsController(
        UserContext userCtx,
        FakeCrmDataGateway gateway,
        bool canAccessOrg,
        bool hasGlobalSuperAdmin,
        bool hasOrgAdmin)
    {
        var policy = new FakeAccessPolicyService
        {
            CanAccessOrgResult = canAccessOrg,
            HasGlobalRoleResult = hasGlobalSuperAdmin,
            HasOrgRoleResult = hasOrgAdmin
        };

        var membership = new MembershipService(gateway, policy);
        var orgService = new OrganizationService(gateway, policy);

        var controller = new OrganizationsController(
            new FakeUserContextAccessor(userCtx),
            new FakeActiveOrganizationResolver(),
            policy,
            membership,
            orgService,
            NullLogger<OrganizationsController>.Instance);

        AttachMvcContext(controller);
        controller.Url = new FakeUrlHelper();
        return controller;
    }

    private static UsersController CreateUsersController(
        UserContext userCtx,
        FakeCrmDataGateway gateway,
        bool canAccessOrg,
        bool hasOrgAdmin)
    {
        var policy = new FakeAccessPolicyService
        {
            CanAccessOrgResult = canAccessOrg,
            HasOrgRoleResult = hasOrgAdmin,
            HasGlobalRoleResult = false
        };

        var membership = new MembershipService(gateway, policy);
        var invitations = new InvitationService(gateway, policy);

        var controller = new UsersController(
            new FakeUserContextAccessor(userCtx),
            membership,
            invitations,
            NullLogger<UsersController>.Instance);

        AttachMvcContext(controller);
        return controller;
    }

    private static AssignmentsController CreateAssignmentsController(
        UserContext userCtx,
        FakeCrmDataGateway gateway,
        bool hasGlobalSuperAdmin,
        bool hasOrgAdmin,
        bool hasPractitionerRole,
        bool canAccessOrg)
    {
        var policy = new FakeAccessPolicyService
        {
            HasGlobalRoleResult = hasGlobalSuperAdmin,
            HasOrgRoleResult = hasOrgAdmin,
            HasPractitionerRoleResult = hasPractitionerRole,
            CanAccessOrgResult = canAccessOrg
        };

        var assignmentService = new AssignmentService(gateway, policy);

        var controller = new AssignmentsController(
            new FakeUserContextAccessor(userCtx),
            policy,
            assignmentService,
            NullLogger<AssignmentsController>.Instance);

        AttachMvcContext(controller);
        return controller;
    }

    private static void AttachMvcContext(Controller controller)
    {
        var http = new DefaultHttpContext();
        controller.ControllerContext = new ControllerContext { HttpContext = http };
        controller.TempData = new TempDataDictionary(http, new TestTempDataProvider());
    }

    private sealed class TestTempDataProvider : ITempDataProvider
    {
        public IDictionary<string, object> LoadTempData(HttpContext context) => new Dictionary<string, object>();

        public void SaveTempData(HttpContext context, IDictionary<string, object> values)
        {
        }
    }

    private sealed class FakeUrlHelper : IUrlHelper
    {
        public ActionContext ActionContext => new();

        public string? Action(UrlActionContext actionContext) => actionContext.Action;

        public string? Content(string? contentPath) => contentPath;

        public bool IsLocalUrl(string? url)
            => !string.IsNullOrWhiteSpace(url) && url.StartsWith('/');

        public string? Link(string? routeName, object? values) => null;

        public string? RouteUrl(UrlRouteContext routeContext) => null;
    }
}

internal static class TestUsers
{
    public static UserContext SuperAdmin(Guid? activeOrgId)
        => Build("super_admin", activeOrgId, Guid.NewGuid(), "super@vitaloop.today", []);

    public static UserContext OrgAdmin(Guid? activeOrgId)
        => Build(
            "end_user",
            activeOrgId,
            Guid.NewGuid(),
            "admin@vitaloop.today",
            activeOrgId.HasValue
                ? [new Membership { OrganizationId = activeOrgId.Value, Role = "client_admin", Status = "active" }]
                : []);

    public static UserContext Practitioner(Guid orgId, Guid userId)
        => Build(
            "end_user",
            orgId,
            userId,
            "practitioner@vitaloop.today",
            [new Membership { OrganizationId = orgId, Role = "practitioner", Status = "active" }]);

    private static UserContext Build(string globalRole, Guid? activeOrgId, Guid userId, string email, IReadOnlyList<Membership> memberships)
        => new()
        {
            UserId = userId,
            Email = email,
            GlobalRole = globalRole,
            ActiveOrganizationId = activeOrgId,
            Memberships = memberships,
            SubscriptionActive = true,
            SubscriptionStatus = "active"
        };
}

internal sealed class FakeUserContextAccessor : IUserContextAccessor
{
    private readonly UserContext _ctx;

    public FakeUserContextAccessor(UserContext ctx)
    {
        _ctx = ctx;
    }

    public Task<UserContext?> GetCurrent(CancellationToken ct = default) => Task.FromResult<UserContext?>(_ctx);

    public Task<UserContext> GetOrThrow(CancellationToken ct = default) => Task.FromResult(_ctx);
}

internal sealed class FakeAccessPolicyService : IAccessPolicyService
{
    public bool HasGlobalRoleResult { get; init; }
    public bool HasOrgRoleResult { get; init; }
    public bool HasPractitionerRoleResult { get; init; }
    public bool CanAccessOrgResult { get; init; } = true;

    public bool HasGlobalRole(UserContext userCtx, params string[] roles)
    {
        if (roles.Any(r => string.Equals(r, "super_admin", StringComparison.OrdinalIgnoreCase)))
        {
            return HasGlobalRoleResult;
        }

        return false;
    }

    public bool HasOrgRole(UserContext userCtx, Guid orgId, params string[] roles)
    {
        if (roles.Any(r => string.Equals(r, "practitioner", StringComparison.OrdinalIgnoreCase)))
        {
            return HasPractitionerRoleResult;
        }

        return HasOrgRoleResult;
    }

    public bool HasAnyAdminRole(UserContext userCtx) => HasGlobalRoleResult || HasOrgRoleResult;

    public bool IsSubscriptionActive(UserContext userCtx) => userCtx.SubscriptionActive;

    public bool CanAccessOrg(UserContext userCtx, Guid orgId) => CanAccessOrgResult;
}

internal sealed class FakeActiveOrganizationResolver : IActiveOrganizationResolver
{
    public Task<Guid?> GetActiveOrganizationId(UserContext userContext, Guid? hintedOrgId = null, CancellationToken ct = default)
        => Task.FromResult(userContext.ActiveOrganizationId);

    public Task SetActiveOrganizationId(Guid orgId, CancellationToken ct = default) => Task.CompletedTask;
}

internal sealed class FakeCrmDataGateway : Vitaloop.Crm.Web.Services.Data.ICrmDataGateway
{
    public IReadOnlyList<Organization> Organizations { get; set; } = Array.Empty<Organization>();
    public Organization? OneOrganization { get; set; }
    public IReadOnlyList<Member> Members { get; set; } = Array.Empty<Member>();
    public IReadOnlyList<Assignment> Assignments { get; set; } = Array.Empty<Assignment>();
    public string? LastInviteEmail { get; private set; }

    public Task<Organization?> CreateOrganization(Guid ownerId, string name, string slug, string status, string? description, string? logoUrl, CancellationToken ct = default)
        => Task.FromResult<Organization?>(new Organization { Id = Guid.NewGuid(), Name = name, Slug = slug, Status = status, OwnerName = ownerId.ToString() });

    public Task<IReadOnlyList<Organization>> GetOrganizations(CancellationToken ct = default) => Task.FromResult(Organizations);

    public Task<Organization?> GetOrganization(Guid orgId, CancellationToken ct = default) => Task.FromResult(OneOrganization);

    public Task<OrganizationSettings?> GetOrganizationSettings(Guid orgId, CancellationToken ct = default)
        => Task.FromResult<OrganizationSettings?>(new OrganizationSettings { OrganizationId = orgId });

    public Task UpdateOrganization(Guid orgId, UpdateOrganizationRequest request, CancellationToken ct = default) => Task.CompletedTask;

    public Task<IReadOnlyList<Member>> GetMembers(Guid orgId, CancellationToken ct = default) => Task.FromResult(Members);

    public Task ChangeRole(Guid orgId, Guid userId, string role, CancellationToken ct = default) => Task.CompletedTask;

    public Task RemoveMember(Guid orgId, Guid userId, CancellationToken ct = default) => Task.CompletedTask;

    public Task<IReadOnlyList<Invitation>> GetInvitations(Guid orgId, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<Invitation>>(Array.Empty<Invitation>());

    public Task<Invitation?> CreateInvite(Guid orgId, string email, string role, CancellationToken ct = default)
    {
        LastInviteEmail = email;
        return Task.FromResult<Invitation?>(new Invitation { Id = Guid.NewGuid(), Email = email, Role = role, ExpiresAt = DateTimeOffset.UtcNow.AddDays(7), Status = "sent" });
    }

    public Task RevokeInvite(Guid orgId, Guid invitationId, CancellationToken ct = default) => Task.CompletedTask;

    public Task AcceptInvite(string token, CancellationToken ct = default) => Task.CompletedTask;

    public Task<IReadOnlyList<Assignment>> GetAssignments(Guid orgId, CancellationToken ct = default) => Task.FromResult(Assignments);

    public Task Assign(Guid orgId, Guid clientId, Guid practitionerId, CancellationToken ct = default) => Task.CompletedTask;

    public Task Reassign(Guid orgId, Guid assignmentId, Guid practitionerId, CancellationToken ct = default) => Task.CompletedTask;

    public Task UpdateAssignment(Guid orgId, Guid assignmentId, string? status, string? notes, CancellationToken ct = default) => Task.CompletedTask;

    public Task<IReadOnlyList<GlobalUser>> GetGlobalUsers(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<GlobalUser>>(new[]
        {
            new GlobalUser { UserId = Guid.NewGuid(), Email = "owner@vitaloop.today", FullName = "Owner", GlobalRole = "end_user", Status = "active" }
        });

    public Task<PlatformOverview?> GetPlatformOverview(CancellationToken ct = default)
        => Task.FromResult<PlatformOverview?>(new PlatformOverview());

    public Task<IReadOnlyList<AuditLogEntry>> GetAuditLogs(Guid? organizationId = null, int limit = 200, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<AuditLogEntry>>(Array.Empty<AuditLogEntry>());

    public Task<RuntimeReadinessSnapshot?> GetRuntimeReadiness(CancellationToken ct = default)
        => Task.FromResult<RuntimeReadinessSnapshot?>(new RuntimeReadinessSnapshot { Ok = true, MissingCount = 0 });
}
