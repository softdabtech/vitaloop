using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Controllers;

[Route("members")]
[RequireOrgRole("org_owner", "client_admin")]
public class MembersController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly MembershipService _membershipService;

    public MembersController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        MembershipService membershipService)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _membershipService = membershipService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index([FromQuery] string? q, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        var members = await _membershipService.GetMembers(userCtx, activeOrgId, ct);

        var filtered = members
            .Where(m => string.IsNullOrWhiteSpace(q)
                        || m.Email.Contains(q, StringComparison.OrdinalIgnoreCase)
                        || m.FullName.Contains(q, StringComparison.OrdinalIgnoreCase))
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
                SubscriptionStatus = m.SubscriptionStatus
            })
            .ToList();

        var model = new MembersPageViewModel
        {
            ActiveOrganizationId = activeOrgId,
            Search = q ?? string.Empty,
            Members = filtered
        };

        return View(model);
    }

    [HttpPost("change-role")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangeRole([FromForm] Guid userId, [FromForm] string role, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        await _membershipService.ChangeRole(userCtx, activeOrgId, userId, role, ct);
        return RedirectToAction(nameof(Index));
    }

    [HttpPost("remove")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Remove([FromForm] Guid userId, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        await _membershipService.RemoveMember(userCtx, activeOrgId, userId, ct);
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
