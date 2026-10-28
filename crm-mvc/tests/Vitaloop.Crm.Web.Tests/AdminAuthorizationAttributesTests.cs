using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Services.Contracts;
using Xunit;

namespace Vitaloop.Crm.Web.Tests;

public class AdminAuthorizationAttributesTests
{
    [Fact]
    public async Task RequireOrgRole_Without_User_Returns_401()
    {
        var attr = new RequireOrgRoleAttribute("org_owner");
        var accessor = new TestUserContextAccessor(null);
        var policy = new FakeAccessPolicyService();
        var context = BuildAuthContext(accessor, policy);

        await attr.OnAuthorizationAsync(context);

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(context.Result);
        Assert.Equal(401, unauthorized.StatusCode);
    }

    [Fact]
    public async Task RequireOrgRole_With_No_Required_OrgRole_Returns_403()
    {
        var orgId = Guid.NewGuid();
        var attr = new RequireOrgRoleAttribute("client_admin");
        var accessor = new TestUserContextAccessor(TestUsers.OrgAdmin(orgId));
        var policy = new FakeAccessPolicyService
        {
            HasGlobalRoleResult = false,
            HasOrgRoleResult = false
        };
        var context = BuildAuthContext(accessor, policy);

        await attr.OnAuthorizationAsync(context);

        var forbidden = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(403, forbidden.StatusCode);
    }

    [Fact]
    public async Task RequireOrgRole_SuperAdmin_Bypasses_Org_Check()
    {
        var orgId = Guid.NewGuid();
        var attr = new RequireOrgRoleAttribute("client_admin");
        var accessor = new TestUserContextAccessor(TestUsers.SuperAdmin(orgId));
        var policy = new FakeAccessPolicyService { HasGlobalRoleResult = true };
        var context = BuildAuthContext(accessor, policy);

        await attr.OnAuthorizationAsync(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public async Task RequireGlobalRole_Without_Required_Role_Returns_403()
    {
        var orgId = Guid.NewGuid();
        var attr = new RequireGlobalRoleAttribute("super_admin");
        var accessor = new TestUserContextAccessor(TestUsers.OrgAdmin(orgId));
        var policy = new FakeAccessPolicyService { HasGlobalRoleResult = false };
        var context = BuildAuthContext(accessor, policy);

        await attr.OnAuthorizationAsync(context);

        var forbidden = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(403, forbidden.StatusCode);
    }

    private static AuthorizationFilterContext BuildAuthContext(IUserContextAccessor accessor, IAccessPolicyService policy)
    {
        var services = new ServiceCollection()
            .AddSingleton(accessor)
            .AddSingleton(policy)
            .BuildServiceProvider();

        var http = new DefaultHttpContext { RequestServices = services };
        var actionContext = new ActionContext(http, new RouteData(), new ActionDescriptor());
        return new AuthorizationFilterContext(actionContext, new List<IFilterMetadata>());
    }

    private sealed class TestUserContextAccessor : IUserContextAccessor
    {
        private readonly UserContext? _ctx;

        public TestUserContextAccessor(UserContext? ctx)
        {
            _ctx = ctx;
        }

        public Task<UserContext?> GetCurrent(CancellationToken ct = default) => Task.FromResult(_ctx);

        public Task<UserContext> GetOrThrow(CancellationToken ct = default)
            => _ctx is null
                ? throw new UnauthorizedAccessException("No user")
                : Task.FromResult(_ctx);
    }
}
