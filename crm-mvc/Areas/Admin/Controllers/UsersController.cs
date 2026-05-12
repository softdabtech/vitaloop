using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Invitations;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Admin.Controllers;

[Area("Admin")]
[Route("admin/members")]
[RequireOrgRole("org_owner", "client_admin", "manager")]
public class UsersController : Controller
{
    private static readonly HashSet<string> AllowedInvitationRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "org_owner", "client_admin", "manager", "practitioner", "support", "member"
    };

    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly IAccessPolicyService _accessPolicyService;
    private readonly OrganizationService _organizationService;
    private readonly MembershipService _membershipService;
    private readonly InvitationService _invitationService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        IAccessPolicyService accessPolicyService,
        OrganizationService organizationService,
        MembershipService membershipService,
        InvitationService invitationService,
        ILogger<UsersController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _accessPolicyService = accessPolicyService;
        _organizationService = organizationService;
        _membershipService = membershipService;
        _invitationService = invitationService;
        _logger = logger;
    }

    /// <summary>List team members in the active organization.</summary>
    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return RedirectToAction("Index", "Organizations");
        }

        try
        {
            var members = await _membershipService.GetMembers(userCtx, userCtx.ActiveOrganizationId.Value, ct);

            var model = new MembersPageViewModel
            {
                ActiveOrganizationId = userCtx.ActiveOrganizationId.Value,
                Members = members
                    .Select(m => new MemberViewModel
                    {
                        UserId = m.UserId,
                        Email = m.Email,
                        FullName = m.FullName,
                        Age = m.Age,
                        Sex = m.Sex,
                        GlobalRole = m.GlobalRole,
                        OrgRole = m.OrgRole,
                        MembershipStatus = m.MembershipStatus,
                        SubscriptionStatus = m.SubscriptionStatus,
                    })
                    .ToList()
            };

            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading team members");
            TempData["ErrorMessage"] = "Failed to load team members.";
            return View(new MembersPageViewModel());
        }
    }

    /// <summary>Change member role (org admin only).</summary>
    [HttpPost("{userId}/role")]
    [RequireOrgRole("org_owner", "client_admin")]
    public async Task<IActionResult> ChangeRole(Guid userId, [FromForm] string newRole, CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            return BadRequest("No active organization");
        }

        try
        {
            await _membershipService.ChangeRole(userCtx, userCtx.ActiveOrganizationId.Value, userId, newRole, ct);
            TempData["SuccessMessage"] = "Member role updated successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "Insufficient permissions.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing member role");
            TempData["ErrorMessage"] = "Failed to update member role.";
            return RedirectToAction(nameof(Index));
        }
    }

    /// <summary>Update editable member profile fields (org admin/manager).</summary>
    [HttpPost("{userId}/profile")]
    [RequireOrgRole("org_owner", "client_admin", "manager")]
    public async Task<IActionResult> UpdateProfile(
        Guid userId,
        [FromForm] string? fullName,
        [FromForm] int? age,
        [FromForm] string? sex,
        [FromForm] string? subscriptionStatus,
        CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);

        if (!ModelState.IsValid)
        {
            TempData["ErrorMessage"] = "Invalid member profile update request.";
            return RedirectToAction(nameof(Index));
        }

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            return BadRequest("No active organization");
        }

        try
        {
            await _membershipService.UpdateMemberProfile(
                userCtx,
                userCtx.ActiveOrganizationId.Value,
                userId,
                fullName,
                age,
                sex,
                subscriptionStatus,
                ct);
            TempData["SuccessMessage"] = "Member profile updated.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating member profile");
            TempData["ErrorMessage"] = "Failed to update member profile.";
            return RedirectToAction(nameof(Index));
        }
    }

    /// <summary>Remove member from organization (org admin only).</summary>
    [HttpPost("{userId}/remove")]
    [RequireOrgRole("org_owner", "client_admin")]
    public async Task<IActionResult> RemoveMember(Guid userId, CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);

        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            return BadRequest("No active organization");
        }

        try
        {
            await _membershipService.RemoveMember(userCtx, userCtx.ActiveOrganizationId.Value, userId, ct);
            TempData["SuccessMessage"] = "Member removed from organization.";
            return RedirectToAction(nameof(Index));
        }
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "Insufficient permissions.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing member");
            TempData["ErrorMessage"] = "Failed to remove member.";
            return RedirectToAction(nameof(Index));
        }
    }

    /// <summary>Send invitation to new team member.</summary>
    [HttpGet("invite")]
    [RequireOrgRole("org_owner", "client_admin")]
    public async Task<IActionResult> Invite(CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);
        return View(new InvitationViewModel { OrganizationId = userCtx.ActiveOrganizationId ?? Guid.Empty, Role = "member" });
    }

    /// <summary>Submit invitation form.</summary>
    [HttpPost("invite")]
    [RequireOrgRole("org_owner", "client_admin")]
    public async Task<IActionResult> SendInvite(InvitationViewModel model, CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);

        if (!ModelState.IsValid)
        {
            return View("Invite", model);
        }

        try
        {
            var normalizedRole = model.Role?.Trim();
            if (!AllowedInvitationRoles.Contains(normalizedRole ?? string.Empty))
            {
                ModelState.AddModelError(nameof(model.Role), "Selected role is not supported.");
                return View("Invite", model);
            }

            if (!userCtx.ActiveOrganizationId.HasValue)
            {
                TempData["ErrorMessage"] = "No active organization selected.";
                return View("Invite", model);
            }

            await _invitationService.CreateInvite(userCtx, userCtx.ActiveOrganizationId.Value, model.Email, normalizedRole!, ct);
            TempData["SuccessMessage"] = $"Invitation sent to {model.Email}";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending invitation");
            TempData["ErrorMessage"] = "Failed to send invitation.";
            return View("Invite", model);
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
