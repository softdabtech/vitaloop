using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Practitioner.Controllers;

[Area("Practitioner")]
[Route("practitioner/clients")]
[RequireOrgRole("practitioner", "org_owner", "client_admin", "manager")]
public class ClientsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly AssignmentService _assignmentService;
    private readonly IAccessPolicyService _accessPolicyService;
    private readonly OrganizationService _organizationService;
    private readonly ILogger<ClientsController> _logger;

    public ClientsController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        AssignmentService assignmentService,
        IAccessPolicyService accessPolicyService,
        OrganizationService organizationService,
        ILogger<ClientsController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _assignmentService = assignmentService;
        _accessPolicyService = accessPolicyService;
        _organizationService = organizationService;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);
        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return Redirect("/auth/post-login");
        }

        try
        {
            var orgId = userCtx.ActiveOrganizationId.Value;
            var assignments = await _assignmentService.GetAssignments(userCtx, orgId, ct);

            var canSeeAll = _accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin", "manager")
                || _accessPolicyService.HasGlobalRole(userCtx, "super_admin");

            var visible = canSeeAll
                ? assignments
                : assignments.Where(a => a.PractitionerId == userCtx.UserId).ToList();

            var model = new PractitionerClientsPageViewModel
            {
                ActiveOrganizationId = orgId,
                Clients = visible.Select(a => new AssignmentViewModel
                {
                    Id = a.Id,
                    OrganizationId = a.OrganizationId ?? Guid.Empty,
                    ClientId = a.ClientId ?? Guid.Empty,
                    ClientName = a.ClientName,
                    PractitionerId = a.PractitionerId ?? Guid.Empty,
                    PractitionerName = a.PractitionerName,
                    Status = a.Status,
                    Notes = a.Notes,
                    UpdatedAt = a.UpdatedAt,
                }).ToList()
            };

            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load practitioner clients.");
            TempData["ErrorMessage"] = "Could not load client list.";
            return View(new PractitionerClientsPageViewModel());
        }
    }

    [HttpGet("{assignmentId:guid}")]
    public async Task<IActionResult> Profile(Guid assignmentId, CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);
        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return RedirectToAction(nameof(Index));
        }

        var orgId = userCtx.ActiveOrganizationId.Value;
        var assignments = await _assignmentService.GetAssignments(userCtx, orgId, ct);
        var canSeeAll = _accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin", "manager")
            || _accessPolicyService.HasGlobalRole(userCtx, "super_admin");

        var selected = assignments.FirstOrDefault(a => a.Id == assignmentId);
        if (selected is null || (!canSeeAll && selected.PractitionerId != userCtx.UserId))
        {
            TempData["ErrorMessage"] = "Client assignment not found or access denied.";
            return RedirectToAction(nameof(Index));
        }

        return View(new PractitionerClientProfileViewModel
        {
            ActiveOrganizationId = orgId,
            Assignment = new AssignmentViewModel
            {
                Id = selected.Id,
                OrganizationId = selected.OrganizationId ?? Guid.Empty,
                ClientId = selected.ClientId ?? Guid.Empty,
                ClientName = selected.ClientName,
                PractitionerId = selected.PractitionerId ?? Guid.Empty,
                PractitionerName = selected.PractitionerName,
                Status = selected.Status,
                Notes = selected.Notes,
                UpdatedAt = selected.UpdatedAt,
            }
        });
    }

    [HttpPost("{assignmentId:guid}/update")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Update(Guid assignmentId, [FromForm] string status, [FromForm] string notes, CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);
        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return RedirectToAction(nameof(Index));
        }

        try
        {
            await _assignmentService.UpdateAssignment(userCtx, userCtx.ActiveOrganizationId.Value, assignmentId, status, notes, ct);
            TempData["SuccessMessage"] = "Client status and notes updated.";
            return RedirectToAction(nameof(Profile), new { assignmentId });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Assignment update failed for {AssignmentId}", assignmentId);
            TempData["ErrorMessage"] = "Failed to update client details.";
            return RedirectToAction(nameof(Profile), new { assignmentId });
        }
    }

    private async Task<Vitaloop.Crm.Web.Models.Auth.UserContext> EnsureActiveOrganization(
        Vitaloop.Crm.Web.Models.Auth.UserContext userCtx,
        CancellationToken ct)
    {
        if (userCtx.ActiveOrganizationId.HasValue)
        {
            return userCtx;
        }

        if (!_accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            return userCtx;
        }

        var organizations = await _organizationService.GetOrganizations(userCtx, ct);
        var firstOrgId = organizations.FirstOrDefault()?.Id;
        if (firstOrgId.HasValue)
        {
            await _activeOrganizationResolver.SetActiveOrganizationId(firstOrgId.Value, ct);
            userCtx.ActiveOrganizationId = firstOrgId.Value;
        }

        return userCtx;
    }
}
