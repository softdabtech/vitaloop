using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Controllers;

[Route("organizations")]
[RequireOrgRole("org_owner", "client_admin")]
public class OrganizationsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly OrganizationService _organizationService;

    public OrganizationsController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        OrganizationService organizationService)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _organizationService = organizationService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        var orgs = await _organizationService.GetOrganizations(userCtx, ct);
        var model = orgs.Select(o => new OrganizationViewModel
        {
            Id = o.Id,
            Name = o.Name,
            Slug = o.Slug,
            Status = o.Status,
            OwnerName = o.OwnerName
        }).ToList();

        return View(model);
    }

    [HttpGet("settings")]
    public async Task<IActionResult> Settings(CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        var organization = await _organizationService.GetOrganization(userCtx, activeOrgId, ct);
        var settings = await _organizationService.GetOrganizationSettings(userCtx, activeOrgId, ct);

        var model = new OrganizationSettingsPageViewModel
        {
            ActiveOrganizationId = activeOrgId,
            Organization = organization is null
                ? null
                : new OrganizationViewModel
                {
                    Id = organization.Id,
                    Name = organization.Name,
                    Slug = organization.Slug,
                    Status = organization.Status,
                    OwnerName = organization.OwnerName
                },
            TimeZone = settings?.TimeZone ?? "UTC",
            BillingEmail = settings?.BillingEmail ?? string.Empty,
            SupportEmail = settings?.SupportEmail ?? string.Empty,
            IsLocked = settings?.IsLocked ?? false
        };

        return View(model);
    }

    [HttpPost("settings")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateSettings([FromForm] string name, [FromForm] string status, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        await _organizationService.UpdateOrganization(userCtx, activeOrgId, new UpdateOrganizationRequest
        {
            Name = name,
            Status = status
        }, ct);

        return RedirectToAction(nameof(Settings));
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
