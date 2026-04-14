using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Vitaloop.Crm.Web.Services.Auth;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Controllers;

[Route("auth")]
public class AuthController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly AuthRedirectService _authRedirectService;
    private readonly AuthOptions _authOptions;

    public AuthController(
        IUserContextAccessor userContextAccessor,
        AuthRedirectService authRedirectService,
        IOptions<AuthOptions> authOptions)
    {
        _userContextAccessor = userContextAccessor;
        _authRedirectService = authRedirectService;
        _authOptions = authOptions.Value;
    }

    [HttpGet("")]
    [HttpGet("login")]
    public IActionResult Login() => View();

    [HttpGet("forgot-password")]
    public IActionResult ForgotPassword() => View();

    [HttpGet("reset-password")]
    public IActionResult ResetPassword() => View();

    [HttpGet("post-login")]
    public async Task<IActionResult> PostLogin(CancellationToken ct)
    {
        var ctx = await _userContextAccessor.GetOrThrow(ct);
        var destination = _authRedirectService.ResolvePostLoginRedirect(ctx);
        return Redirect(destination);
    }

    /// <summary>
    /// Switch the active organization context for the current session.
    /// Available to any authenticated member — role is checked by the downstream
    /// ActiveOrganizationResolver / AccessPolicyService, not here.
    /// </summary>
    [HttpGet("/organizations/switch/{id:guid}")]
    public async Task<IActionResult> SwitchOrganization(Guid id, CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        // Verify the user is actually a member of the target org.
        var isMember = userCtx.Memberships.Any(m => m.OrganizationId == id);
        if (!isMember)
        {
            TempData["ErrorMessage"] = "You are not a member of that organization.";
            return RedirectToAction("Index", "Dashboard", new { area = "Admin" });
        }

        // Persist the selection in the same cookie the ActiveOrganizationResolver reads.
        Response.Cookies.Append(
            _authOptions.ActiveOrganizationCookieName,
            id.ToString(),
            new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = Request.IsHttps,
                MaxAge = TimeSpan.FromDays(30)
            });

        TempData["SuccessMessage"] = $"Switched to {userCtx.Memberships.FirstOrDefault(m => m.OrganizationId == id)?.OrganizationName ?? id.ToString()}.";

        var returnUrl = Request.Headers.Referer.ToString();
        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return Redirect(returnUrl);
        }

        return RedirectToAction("Index", "Dashboard", new { area = "Admin" });
    }
}

