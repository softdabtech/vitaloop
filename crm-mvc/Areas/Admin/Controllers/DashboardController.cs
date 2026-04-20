using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Invitations;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Admin.Controllers;

[Area("Admin")]
[Route("admin")]
[RequireOrgRole("org_owner", "client_admin")]
public class DashboardController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IAccessPolicyService _accessPolicyService;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly OrganizationService _organizationService;
    private readonly MembershipService _membershipService;
    private readonly InvitationService _invitationService;
    private readonly AssignmentService _assignmentService;

    public DashboardController(
        IUserContextAccessor userContextAccessor,
        IAccessPolicyService accessPolicyService,
        IActiveOrganizationResolver activeOrganizationResolver,
        OrganizationService organizationService,
        MembershipService membershipService,
        InvitationService invitationService,
        AssignmentService assignmentService)
    {
        _userContextAccessor = userContextAccessor;
        _accessPolicyService = accessPolicyService;
        _activeOrganizationResolver = activeOrganizationResolver;
        _organizationService = organizationService;
        _membershipService = membershipService;
        _invitationService = invitationService;
        _assignmentService = assignmentService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        if (!userCtx.ActiveOrganizationId.HasValue && _accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            var organizations = await _organizationService.GetOrganizations(userCtx, ct);
            var firstOrgId = organizations.FirstOrDefault()?.Id;
            if (firstOrgId.HasValue)
            {
                await _activeOrganizationResolver.SetActiveOrganizationId(firstOrgId.Value, ct);
                userCtx.ActiveOrganizationId = firstOrgId.Value;
            }
        }

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return RedirectToAction("Index", "Organizations", new { area = "Admin" });
        }

        var orgId = userCtx.ActiveOrganizationId.Value;
        var members = await _membershipService.GetMembers(userCtx, orgId, ct);
        var invitations = await _invitationService.GetInvitations(userCtx, orgId, ct);
        var assignments = await _assignmentService.GetAssignments(userCtx, orgId, ct);

        var model = new AdminDashboardViewModel
        {
            ActiveOrganizationId = orgId,
            TotalMembers = members.Count,
            PendingInvites = invitations.Count(i => string.Equals(i.Status, "sent", StringComparison.OrdinalIgnoreCase)),
            ActiveAssignments = assignments.Count(a => string.Equals(a.Status, "active", StringComparison.OrdinalIgnoreCase)),
        };

        return View(model);
    }
}
