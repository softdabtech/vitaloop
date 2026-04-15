using System.Net;
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
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IUserContextAccessor userContextAccessor,
        AuthRedirectService authRedirectService,
        IOptions<AuthOptions> authOptions,
        ILogger<AuthController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _authRedirectService = authRedirectService;
        _authOptions = authOptions.Value;
        _logger = logger;
    }

    [HttpGet("")]
    [HttpGet("login")]
    public IActionResult Login([FromQuery] string? returnUrl = null)
    {
        var fallbackReturnUrl = Url.Action(nameof(PostLogin), "Auth") ?? "/auth/post-login";
        var targetReturnUrl = NormalizeReturnUrlOrFallback(returnUrl, fallbackReturnUrl);

        return Redirect(BuildFrontendLoginUrl(targetReturnUrl));
    }

    [HttpPost("")]
    [HttpPost("login")]
    [IgnoreAntiforgeryToken]
    public IActionResult LoginPost([FromQuery] string? returnUrl = null)
    {
        var fallbackReturnUrl = Url.Action(nameof(PostLogin), "Auth") ?? "/auth/post-login";
        var targetReturnUrl = NormalizeReturnUrlOrFallback(returnUrl, fallbackReturnUrl);
        return Redirect(BuildFrontendLoginUrl(targetReturnUrl));
    }

    [HttpGet("forgot-password")]
    public IActionResult ForgotPassword() => View();

    [HttpGet("reset-password")]
    public IActionResult ResetPassword() => View();

    [HttpGet("post-login")]
    public async Task<IActionResult> PostLogin([FromQuery] string? token, [FromQuery] string? returnUrl, CancellationToken ct)
        => await PostLoginCore(token, returnUrl, ct);

    [HttpPost("post-login")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> PostLoginPost([FromForm] string? token, [FromForm] string? returnUrl, CancellationToken ct)
        => await PostLoginCore(token, returnUrl, ct);

    private async Task<IActionResult> PostLoginCore(string? token, string? returnUrl, CancellationToken ct)
    {
        Console.WriteLine("[CRM] post-login called");
        Console.WriteLine($"[CRM] token present: {!string.IsNullOrEmpty(token)}");
        Console.WriteLine($"[CRM] token length: {token?.Length}");

        var normalizedReturnUrl = NormalizeReturnUrlOrFallback(returnUrl, string.Empty);

        if (!string.IsNullOrWhiteSpace(token))
        {
            _logger.LogInformation("SSO bridge token received for CRM handoff.");
            Response.Cookies.Append(
                _authOptions.TokenCookieName,
                token,
                new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.None,
                    Secure = true,
                    Domain = ".vitaloop.today",
                    Path = "/",
                    MaxAge = TimeSpan.FromHours(12)
                });
            if (!string.IsNullOrWhiteSpace(normalizedReturnUrl))
            {
                return RedirectToAction(nameof(PostLogin), new { returnUrl = normalizedReturnUrl });
            }

            return RedirectToAction(nameof(PostLogin));
        }

        try
        {
            Console.WriteLine("[CRM] validation start");
            var ctx = await _userContextAccessor.GetOrThrow(ct);
            Console.WriteLine("[CRM] validation result: success");
            Console.WriteLine("[CRM] validation error: ");
            if (!string.IsNullOrWhiteSpace(normalizedReturnUrl))
            {
                _logger.LogInformation("SSO login succeeded for user {UserId}; redirecting to returnUrl {ReturnUrl}.", ctx.UserId, normalizedReturnUrl);
                return Redirect(normalizedReturnUrl);
            }

            var destination = _authRedirectService.ResolvePostLoginRedirect(ctx);
            _logger.LogInformation("SSO login succeeded for user {UserId}; redirecting to {Destination}.", ctx.UserId, destination);
            return Redirect(destination);
        }
        catch (UnauthorizedAccessException ex)
        {
            Console.WriteLine("[CRM] validation result: failed");
            Console.WriteLine($"[CRM] validation error: {ex.GetType().Name}: {ex.Message}");
            _logger.LogWarning("SSO login failed: user context unavailable after token handoff.");
            Response.Cookies.Delete(_authOptions.TokenCookieName, new CookieOptions
            {
                Domain = ".vitaloop.today",
                Path = "/"
            });

            var loginReturnUrl = Url.Action(nameof(PostLogin), "Auth") ?? "/auth/post-login";
            return Redirect(BuildFrontendLoginUrl(loginReturnUrl));
        }
    }

    [HttpGet("logout")]
    [HttpPost("logout")]
    [IgnoreAntiforgeryToken]
    public IActionResult Logout()
    {
        var hadToken = Request.Cookies.ContainsKey(_authOptions.TokenCookieName);

        Response.Cookies.Delete(_authOptions.TokenCookieName, new CookieOptions
        {
            Domain = ".vitaloop.today",
            Path = "/"
        });

        Response.Cookies.Delete(_authOptions.ActiveOrganizationCookieName, new CookieOptions
        {
            Path = "/"
        });

        _logger.LogInformation("CRM logout executed; auth cookie present before clear: {HadTokenCookie}.", hadToken);

        return Redirect(_authOptions.FrontendLoginUrl);
    }

    private static string NormalizeReturnUrlOrFallback(string? returnUrl, string fallback)
    {
        if (string.IsNullOrWhiteSpace(returnUrl))
        {
            return fallback;
        }

        if (!Uri.TryCreate(returnUrl, UriKind.Relative, out var relative))
        {
            return fallback;
        }

        return relative.OriginalString.StartsWith('/') ? relative.OriginalString : fallback;
    }

    private string BuildFrontendLoginUrl(string returnUrl)
    {
        var encodedReturnUrl = WebUtility.UrlEncode(returnUrl);
        var separator = _authOptions.FrontendLoginUrl.Contains('?') ? "&" : "?";
        return $"{_authOptions.FrontendLoginUrl}{separator}returnUrl={encodedReturnUrl}";
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

