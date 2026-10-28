using Microsoft.AspNetCore.Mvc;
using System.Linq;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Controllers;

[Route("settings")]
public class SettingsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;

    public SettingsController(IUserContextAccessor userContextAccessor)
    {
        _userContextAccessor = userContextAccessor;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetCurrent(ct);

        var model = new SettingsPageViewModel
        {
            DisplayName = userCtx?.Email?.Split('@').FirstOrDefault() ?? string.Empty,
            Email = userCtx?.Email ?? string.Empty,
            TimeZone = Request.Cookies.TryGetValue("vo_pref_timezone", out var tz) ? tz : "UTC",
            Language = Request.Cookies.TryGetValue("vo_pref_language", out var lang) ? lang : "en",
            CompactMode = Request.Cookies.TryGetValue("vo_pref_compact_mode", out var compact) && compact == "1",
            EmailDigestEnabled = !Request.Cookies.TryGetValue("vo_pref_email_digest", out var digest) || digest != "0",
            SecurityAlertsEnabled = !Request.Cookies.TryGetValue("vo_pref_security_alerts", out var alerts) || alerts != "0",
        };

        return View(model);
    }

    [HttpPost("")]
    [ValidateAntiForgeryToken]
    public IActionResult Save(
        [FromForm] string timeZone,
        [FromForm] string language,
        [FromForm] bool compactMode,
        [FromForm] bool emailDigestEnabled,
        [FromForm] bool securityAlertsEnabled)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(365),
        };

        Response.Cookies.Append("vo_pref_timezone", string.IsNullOrWhiteSpace(timeZone) ? "UTC" : timeZone, cookieOptions);
        Response.Cookies.Append("vo_pref_language", string.IsNullOrWhiteSpace(language) ? "en" : language, cookieOptions);
        Response.Cookies.Append("vo_pref_compact_mode", compactMode ? "1" : "0", cookieOptions);
        Response.Cookies.Append("vo_pref_email_digest", emailDigestEnabled ? "1" : "0", cookieOptions);
        Response.Cookies.Append("vo_pref_security_alerts", securityAlertsEnabled ? "1" : "0", cookieOptions);

        TempData["SuccessMessage"] = "Settings saved.";
        return RedirectToAction(nameof(Index));
    }
}
