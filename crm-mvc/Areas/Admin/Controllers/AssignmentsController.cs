using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Admin.Controllers;

[Area("Admin")]
[Route("admin/assignments")]
[RequireOrgRole("org_owner", "client_admin", "manager", "practitioner")]
public class AssignmentsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IAccessPolicyService _accessPolicyService;
    private readonly AssignmentService _assignmentService;
    private readonly ILogger<AssignmentsController> _logger;

    public AssignmentsController(
        IUserContextAccessor userContextAccessor,
        IAccessPolicyService accessPolicyService,
        AssignmentService assignmentService,
        ILogger<AssignmentsController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _accessPolicyService = accessPolicyService;
        _assignmentService = assignmentService;
        _logger = logger;
    }

    /// <summary>List practitioner-client assignments.</summary>
    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return RedirectToAction("Index", "Organizations");
        }

        try
        {
            var assignments = await _assignmentService.GetAssignments(userCtx, userCtx.ActiveOrganizationId.Value, ct);

            // Filter based on user role
            var isSuperAdmin = _accessPolicyService.HasGlobalRole(userCtx, "super_admin");
            var isOrgAdmin = _accessPolicyService.HasOrgRole(userCtx, userCtx.ActiveOrganizationId.Value, "org_owner", "client_admin");
            var isPractitioner = _accessPolicyService.HasOrgRole(userCtx, userCtx.ActiveOrganizationId.Value, "practitioner");

            var filtered = assignments.Where(a =>
            {
                if (isSuperAdmin || isOrgAdmin) return true;
                if (isPractitioner && a.PractitionerId == userCtx.UserId) return true;
                return false;
            }).ToList();

            var model = new AssignmentsPageViewModel
            {
                ActiveOrganizationId = userCtx.ActiveOrganizationId.Value,
                Assignments = filtered
                    .Select(a => new AssignmentViewModel
                    {
                        Id = a.Id,
                        OrganizationId = a.OrganizationId,
                        ClientId = a.ClientId,
                        ClientName = a.ClientName,
                        PractitionerId = a.PractitionerId,
                        PractitionerName = a.PractitionerName,
                        Status = a.Status,
                        Notes = a.Notes,
                        UpdatedAt = a.UpdatedAt,
                    })
                    .ToList()
            };

            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading assignments");
            TempData["ErrorMessage"] = "Failed to load assignments.";
            return View(new AssignmentsPageViewModel());
        }
    }

    /// <summary>Create new practitioner-client assignment (org admin only).</summary>
    [HttpGet("create")]
    [RequireOrgRole("org_owner", "client_admin", "manager")]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            return BadRequest("No active organization");
        }

        // TODO: Load practitioners and clients from backend
        return View(new CreateAssignmentViewModel { OrganizationId = userCtx.ActiveOrganizationId.Value });
    }

    /// <summary>Submit assignment creation form.</summary>
    [HttpPost("create")]
    [RequireOrgRole("org_owner", "client_admin", "manager")]
    public async Task<IActionResult> Create(CreateAssignmentViewModel model, CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            return BadRequest("No active organization");
        }

        try
        {
            await _assignmentService.Assign(userCtx, userCtx.ActiveOrganizationId.Value, model.ClientId, model.PractitionerId, ct);
            TempData["SuccessMessage"] = "Practitioner assigned to client successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "Insufficient permissions.";
            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating assignment");
            TempData["ErrorMessage"] = "Failed to create assignment.";
            return View(model);
        }
    }

    /// <summary>Reassign client to different practitioner (org admin only).</summary>
    [HttpPost("{assignmentId}/reassign")]
    [RequireOrgRole("org_owner", "client_admin", "manager")]
    public async Task<IActionResult> Reassign(Guid assignmentId, Guid newPractitionerId, CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            return BadRequest("No active organization");
        }

        try
        {
            await _assignmentService.Reassign(userCtx, userCtx.ActiveOrganizationId.Value, assignmentId, newPractitionerId, ct);
            TempData["SuccessMessage"] = "Client reassigned to different practitioner.";
            return RedirectToAction(nameof(Index));
        }
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "Insufficient permissions.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reassigning client");
            TempData["ErrorMessage"] = "Failed to reassign client.";
            return RedirectToAction(nameof(Index));
        }
    }
}
