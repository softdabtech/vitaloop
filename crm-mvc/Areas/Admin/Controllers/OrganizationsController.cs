using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Admin.Controllers;

[Area("Admin")]
[Route("admin/organizations")]
[RequireGlobalRole("super_admin", "client_admin")]
public class OrganizationsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly IAccessPolicyService _accessPolicyService;
    private readonly MembershipService _membershipService;
    private readonly OrganizationService _organizationService;
    private readonly ILogger<OrganizationsController> _logger;

    public OrganizationsController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        IAccessPolicyService accessPolicyService,
        MembershipService membershipService,
        OrganizationService organizationService,
        ILogger<OrganizationsController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _accessPolicyService = accessPolicyService;
        _membershipService = membershipService;
        _organizationService = organizationService;
        _logger = logger;
    }

    /// <summary>List all organizations.</summary>
    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        try
        {
            var organizations = await _organizationService.GetOrganizations(userCtx, ct);

            var model = new OrganizationsPageViewModel
            {
                Organizations = organizations
                    .Select(o => new OrganizationViewModel
                    {
                        Id = o.Id,
                        Name = o.Name,
                        Slug = o.Slug,
                        Status = o.Status,
                        OwnerName = o.OwnerName,
                    })
                    .ToList(),
                IsSuperAdmin = _accessPolicyService.HasGlobalRole(userCtx, "super_admin"),
                CreateOrgUrl = "/admin/organizations/create"
            };

            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading organizations");
            TempData["ErrorMessage"] = "Failed to load organizations.";
            return View(new OrganizationsPageViewModel());
        }
    }

    /// <summary>Show create organization form.</summary>
    [HttpGet("create")]
    [RequireGlobalRole("super_admin")]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        if (!_accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            TempData["ErrorMessage"] = "Only Super Admins can create organizations.";
            return RedirectToAction(nameof(Index));
        }

        return View(new CreateOrganizationViewModel());
    }

    /// <summary>Submit create organization form.</summary>
    [HttpPost("create")]
    [RequireGlobalRole("super_admin")]
    public async Task<IActionResult> Create(CreateOrganizationViewModel model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        try
        {
            var users = await _membershipService.GetGlobalUsers(userCtx, ct);
            var owner = users.FirstOrDefault(u => string.Equals(u.Email, model.OwnerEmail, StringComparison.OrdinalIgnoreCase));
            if (owner is null)
            {
                ModelState.AddModelError(nameof(model.OwnerEmail), "Owner email was not found among existing users.");
                return View(model);
            }

            var org = await _organizationService.CreateOrganization(
                userCtx,
                owner.UserId,
                model.Name,
                model.Slug,
                model.Status,
                model.Description,
                model.LogoUrl,
                ct);

            if (org is null)
            {
                TempData["ErrorMessage"] = "Backend did not return the created organization.";
                return View(model);
            }

            TempData["SuccessMessage"] = $"Organization '{model.Name}' created successfully.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating organization");
            TempData["ErrorMessage"] = "Failed to create organization.";
            return View(model);
        }
    }

    /// <summary>View organization details.</summary>
    [HttpGet("{orgId}")]
    public async Task<IActionResult> Details(Guid orgId, CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        try
        {
            var org = await _organizationService.GetOrganization(userCtx, orgId, ct);
            if (org is null)
            {
                TempData["ErrorMessage"] = "Organization not found.";
                return RedirectToAction(nameof(Index));
            }

            var members = await _organizationService.GetMembers(userCtx, orgId, ct);

            var model = new OrganizationDetailViewModel
            {
                Id = org.Id,
                Name = org.Name,
                Slug = org.Slug,
                Status = org.Status,
                OwnerName = org.OwnerName,
                MemberCount = members.Count,
                PractitionerCount = members.Count(m => string.Equals(m.OrgRole, "practitioner", StringComparison.OrdinalIgnoreCase)),
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
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "You don't have access to this organization.";
            return RedirectToAction(nameof(Index));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading organization details");
            TempData["ErrorMessage"] = "Failed to load organization details.";
            return RedirectToAction(nameof(Index));
        }
    }

    /// <summary>Edit organization status.</summary>
    [HttpPost("{orgId}/status")]
    [RequireGlobalRole("super_admin", "client_admin")]
    public async Task<IActionResult> UpdateStatus(Guid orgId, string status, CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);

        try
        {
            if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
            {
                return Forbid();
            }

            var request = new Models.Crm.UpdateOrganizationRequest { Status = status };
            await _organizationService.UpdateOrganization(userCtx, orgId, request, ct);

            TempData["SuccessMessage"] = $"Organization status updated to '{status}'.";
            return RedirectToAction(nameof(Details), new { orgId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating organization status");
            TempData["ErrorMessage"] = "Failed to update organization status.";
            return RedirectToAction(nameof(Details), new { orgId });
        }
    }

    [HttpGet("/admin/orgs/{orgId}/switch")]
    public async Task<IActionResult> Switch(Guid orgId, [FromQuery] string? returnUrl = null, CancellationToken ct = default)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        if (!_accessPolicyService.CanAccessOrg(userCtx, orgId))
        {
            TempData["ErrorMessage"] = "You do not have access to that organization.";
            return RedirectToAction(nameof(Index));
        }

        await _activeOrganizationResolver.SetActiveOrganizationId(orgId, ct);

        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return Redirect(returnUrl);
        }

        return RedirectToAction("Index", "Dashboard", new { area = "Admin" });
    }
}
