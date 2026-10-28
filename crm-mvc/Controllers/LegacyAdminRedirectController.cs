using Microsoft.AspNetCore.Mvc;

namespace Vitaloop.Crm.Web.Controllers;

/// <summary>
/// 2026-09-13 CRM information-architecture rename: Areas/Admin became
/// Areas/Org (routes /admin/* -> /org/*) because "Admin" was misleading —
/// it's the org owner's own console, not the platform-wide super_admin area
/// (that's /ops). Anyone with an old /admin/* bookmark, browser history
/// entry, or saved link should still land in the right place instead of
/// hitting a 404. A permanent (301) redirect preserves the path suffix and
/// query string exactly, so e.g. /admin/members/invite?foo=bar still works
/// as /org/members/invite?foo=bar. This controller is intentionally the
/// ONLY thing living at the old prefix — it does nothing else.
/// </summary>
public class LegacyAdminRedirectController : Controller
{
    [HttpGet("/admin")]
    [HttpGet("/admin/{**rest}")]
    public IActionResult RedirectToOrg(string? rest)
    {
        var target = string.IsNullOrEmpty(rest) ? "/org" : $"/org/{rest}";
        if (Request.QueryString.HasValue)
        {
            target += Request.QueryString.Value;
        }

        return RedirectPermanent(target);
    }
}
