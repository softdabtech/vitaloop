using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Vitaloop.Crm.Web.Controllers;
using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Services.Auth;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Invitations;
using Vitaloop.Crm.Web.Services.Memberships;
using Xunit;

namespace Vitaloop.Crm.Web.Tests;

// ────────────────────────────────────────────────────────────────────────────
// VersionController
// ────────────────────────────────────────────────────────────────────────────

public class VersionControllerTests
{
    [Fact]
    public void Get_Returns_Ok_With_Service_Name()
    {
        var result = new VersionController().Get();
        var ok = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("vitaloop-crm", json);
    }

    [Fact]
    public void Get_Response_Contains_Version_And_Release_Fields()
    {
        var ok = Assert.IsType<OkObjectResult>(new VersionController().Get());
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("version", json);
        Assert.Contains("release_version", json);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// AuthController
// ────────────────────────────────────────────────────────────────────────────

public class AuthControllerTests
{
    private static AuthController CreateController(UserContext? userCtx = null)
    {
        var options = Options.Create(new AuthOptions());
        var controller = new AuthController(
            new FakeUserContextAccessor(userCtx ?? TestUsers.OrgAdmin(Guid.NewGuid())),
            new AuthRedirectService(),
            options,
            NullLogger<AuthController>.Instance);
        var http = new DefaultHttpContext();
        controller.ControllerContext = new ControllerContext { HttpContext = http };
        // Provide a UrlHelper so Url.Action() doesn't NPE
        controller.Url = new FakeUrlHelper();
        return controller;
    }

    [Fact]
    public void Login_Returns_Redirect()
    {
        var result = CreateController().Login(returnUrl: null);
        Assert.IsType<RedirectResult>(result);
    }

    [Fact]
    public void Login_With_ReturnUrl_Returns_Redirect()
    {
        var result = CreateController().Login(returnUrl: "/dashboard");
        Assert.IsType<RedirectResult>(result);
    }

    [Fact]
    public void LoginPost_Returns_Redirect()
    {
        var result = CreateController().LoginPost(returnUrl: null);
        Assert.IsType<RedirectResult>(result);
    }

    [Fact]
    public void Logout_Returns_Redirect()
    {
        var result = CreateController().Logout();
        Assert.IsAssignableFrom<IActionResult>(result);
    }

    [Fact]
    public void ForgotPassword_Returns_View()
    {
        Assert.IsType<ViewResult>(CreateController().ForgotPassword());
    }

    [Fact]
    public void ResetPassword_Returns_View()
    {
        Assert.IsType<ViewResult>(CreateController().ResetPassword());
    }

    // Fake UrlHelper — reuse from AdminControllersTests
    private sealed class FakeUrlHelper : IUrlHelper
    {
        public ActionContext ActionContext => new();
        public string? Action(UrlActionContext ctx) => ctx.Action ?? "/fallback";
        public string? Content(string? contentPath) => contentPath;
        public bool IsLocalUrl(string? url) => !string.IsNullOrWhiteSpace(url) && url.StartsWith('/');
        public string? Link(string? routeName, object? values) => null;
        public string? RouteUrl(UrlRouteContext routeContext) => null;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// MembersController
// ────────────────────────────────────────────────────────────────────────────

public class MembersControllerTests
{
    private static MembersController CreateController(UserContext? userCtx = null)
    {
        var ctx = userCtx ?? TestUsers.OrgAdmin(Guid.NewGuid());
        var gw = new FakeCrmDataGateway();
        var policy = new FakeAccessPolicyService { CanAccessOrgResult = true, HasOrgRoleResult = true };
        var membership = new MembershipService(gw, policy);
        var controller = new MembersController(
            new FakeUserContextAccessor(ctx),
            new FakeActiveOrganizationResolver(),
            membership);
        MvcHelpers.AttachContext(controller);
        return controller;
    }

    [Fact]
    public async Task Index_With_ActiveOrg_Returns_View()
    {
        var result = await CreateController().Index(q: null, CancellationToken.None);
        Assert.IsType<ViewResult>(result);
    }

    [Fact]
    public async Task Index_Without_ActiveOrg_Throws_Unauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => CreateController(TestUsers.OrgAdmin(null)).Index(null, CancellationToken.None));
    }

    [Fact]
    public async Task ChangeRole_Without_ActiveOrg_Throws_Unauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => CreateController(TestUsers.OrgAdmin(null))
                .ChangeRole(Guid.NewGuid(), "practitioner", CancellationToken.None));
    }

    [Fact]
    public async Task Remove_Without_ActiveOrg_Throws_Unauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => CreateController(TestUsers.OrgAdmin(null))
                .Remove(Guid.NewGuid(), CancellationToken.None));
    }
}

// ────────────────────────────────────────────────────────────────────────────
// InvitationsController
// ────────────────────────────────────────────────────────────────────────────

public class InvitationsControllerTests
{
    private static InvitationsController CreateController(UserContext? userCtx = null)
    {
        var ctx = userCtx ?? TestUsers.OrgAdmin(Guid.NewGuid());
        var gw = new FakeCrmDataGateway();
        var policy = new FakeAccessPolicyService { CanAccessOrgResult = true, HasOrgRoleResult = true };
        var invitations = new InvitationService(gw, policy);
        var controller = new InvitationsController(
            new FakeUserContextAccessor(ctx),
            new FakeActiveOrganizationResolver(),
            invitations);
        MvcHelpers.AttachContext(controller);
        return controller;
    }

    [Fact]
    public async Task Index_With_ActiveOrg_Returns_View()
    {
        var result = await CreateController().Index(q: null, CancellationToken.None);
        Assert.IsType<ViewResult>(result);
    }

    [Fact]
    public async Task Index_Without_ActiveOrg_Throws_Unauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => CreateController(TestUsers.OrgAdmin(null)).Index(null, CancellationToken.None));
    }

    [Fact]
    public async Task Create_Without_ActiveOrg_Throws_Unauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => CreateController(TestUsers.OrgAdmin(null))
                .Create("x@example.com", "practitioner", CancellationToken.None));
    }

    [Fact]
    public async Task Revoke_Without_ActiveOrg_Throws_Unauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => CreateController(TestUsers.OrgAdmin(null))
                .Revoke(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task Accept_EmptyToken_Redirects_To_Login()
    {
        var result = await CreateController().Accept(token: "", CancellationToken.None);
        var redirect = Assert.IsType<RedirectResult>(result);
        Assert.Contains("login", redirect.Url);
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

internal static class MvcHelpers
{
    public static void AttachContext(Controller controller)
    {
        var http = new DefaultHttpContext();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = http,
            RouteData = new Microsoft.AspNetCore.Routing.RouteData(),
        };
        controller.TempData = new Microsoft.AspNetCore.Mvc.ViewFeatures.TempDataDictionary(
            http, new NullTempDataProvider());
    }
}

internal sealed class NullTempDataProvider
    : Microsoft.AspNetCore.Mvc.ViewFeatures.ITempDataProvider
{
    public IDictionary<string, object> LoadTempData(HttpContext _) => new Dictionary<string, object>();
    public void SaveTempData(HttpContext _, IDictionary<string, object> __) { }
}
