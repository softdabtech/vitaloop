using System.Net.Http;
using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Ops.Controllers;

[Area("Ops")]
[Route("ops/activity")]
[RequireGlobalRole("super_admin")]
public class AuditController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly MembershipService _membershipService;

    public AuditController(IUserContextAccessor userContextAccessor, MembershipService membershipService)
    {
        _userContextAccessor = userContextAccessor;
        _membershipService = membershipService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index([FromQuery] Guid? organizationId, [FromQuery] int limit = 200, CancellationToken ct = default)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        try
        {
            var logs = await _membershipService.GetAuditLogs(userCtx, organizationId, limit, ct);
            var model = new OpsAuditPageViewModel
            {
                Limit = Math.Clamp(limit, 1, 1000),
                OrganizationId = organizationId,
                Logs = logs.Select(l => new OpsAuditLogViewModel
                {
                    Id = l.Id,
                    UserId = l.UserId,
                    Action = l.Action,
                    EntityType = l.EntityType,
                    EntityId = l.EntityId,
                    OrganizationId = l.OrganizationId,
                    Timestamp = l.Timestamp,
                }).ToList()
            };

            return View(model);
        }
        catch (HttpRequestException)
        {
            TempData["ErrorMessage"] = "Activity log is temporarily unavailable.";
            return View(new OpsAuditPageViewModel());
        }
    }
}
