using System.Net.Http;
using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Ops.Controllers;

[Area("Ops")]
[Route("ops")]
[RequireGlobalRole("super_admin")]
public class DashboardController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly MembershipService _membershipService;

    public DashboardController(IUserContextAccessor userContextAccessor, MembershipService membershipService)
    {
        _userContextAccessor = userContextAccessor;
        _membershipService = membershipService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        IReadOnlyList<GlobalUser> users;
        try
        {
            users = await _membershipService.GetGlobalUsers(userCtx, ct);
        }
        catch (HttpRequestException)
        {
            // Keep Ops page accessible even when optional admin API is unavailable.
            users = Array.Empty<GlobalUser>();
            TempData["WarningMessage"] = "Global users feed is temporarily unavailable.";
        }

        var model = new OpsDashboardViewModel
        {
            GlobalUsers = users.Select(u => new MemberViewModel
            {
                UserId = u.UserId,
                Email = u.Email,
                FullName = u.FullName,
                GlobalRole = u.GlobalRole,
                OrgRole = "-",
                MembershipStatus = u.Status,
                SubscriptionStatus = "-"
            }).ToList()
        };

        return View(model);
    }
}
