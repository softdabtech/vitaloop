using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Controllers;

[Route("assignments")]
[RequireOrgRole("org_owner", "client_admin")]
public class AssignmentsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly AssignmentService _assignmentService;

    public AssignmentsController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        AssignmentService assignmentService)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _assignmentService = assignmentService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        var assignments = await _assignmentService.GetAssignments(userCtx, activeOrgId, ct);

        var model = new AssignmentsPageViewModel
        {
            ActiveOrganizationId = activeOrgId,
            Assignments = assignments.Select(a => new AssignmentViewModel
            {
                Id = a.Id,
                ClientId = a.ClientId,
                ClientName = a.ClientName,
                PractitionerId = a.PractitionerId,
                PractitionerName = a.PractitionerName,
                Status = a.Status
            }).ToList()
        };

        return View(model);
    }

    [HttpPost("create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create([FromForm] Guid clientId, [FromForm] Guid practitionerId, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        await _assignmentService.Assign(userCtx, activeOrgId, clientId, practitionerId, ct);
        return RedirectToAction(nameof(Index));
    }

    [HttpPost("reassign")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Reassign([FromForm] Guid assignmentId, [FromForm] Guid practitionerId, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        await _assignmentService.Reassign(userCtx, activeOrgId, assignmentId, practitionerId, ct);
        return RedirectToAction(nameof(Index));
    }

    private async Task<(Vitaloop.Crm.Web.Models.Auth.UserContext UserContext, Guid ActiveOrganizationId)> ResolveContext(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        var hintedOrg = TryParseOrgHint();
        var activeOrgId = await _activeOrganizationResolver.GetActiveOrganizationId(userCtx, hintedOrg, ct);
        if (!activeOrgId.HasValue)
        {
            throw new UnauthorizedAccessException("No active organization available for request.");
        }

        return (userCtx, activeOrgId.Value);
    }

    private Guid? TryParseOrgHint()
    {
        var routeRaw = RouteData.Values.TryGetValue("orgId", out var routeOrg) ? routeOrg?.ToString() : null;
        if (Guid.TryParse(routeRaw, out var routeGuid))
        {
            return routeGuid;
        }

        var queryRaw = Request.Query["org_id"].ToString();
        if (Guid.TryParse(queryRaw, out var queryGuid))
        {
            return queryGuid;
        }

        var queryAliasRaw = Request.Query["orgId"].ToString();
        if (Guid.TryParse(queryAliasRaw, out var queryAliasGuid))
        {
            return queryAliasGuid;
        }

        return null;
    }
}
