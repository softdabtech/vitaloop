using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Invitations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Controllers;

[Route("invitations")]
[RequireOrgRole("org_owner", "client_admin")]
public class InvitationsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly InvitationService _invitationService;

    public InvitationsController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        InvitationService invitationService)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _invitationService = invitationService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index([FromQuery] string? q, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        var invitations = await _invitationService.GetInvitations(userCtx, activeOrgId, ct);

        var filtered = invitations
            .Where(i => string.IsNullOrWhiteSpace(q) || i.Email.Contains(q, StringComparison.OrdinalIgnoreCase))
            .Select(i => new InvitationViewModel
            {
                Id = i.Id,
                Email = i.Email,
                Role = i.Role,
                Status = i.Status,
                ExpiresAt = i.ExpiresAt
            })
            .ToList();

        return View(new InvitationsPageViewModel
        {
            ActiveOrganizationId = activeOrgId,
            Search = q ?? string.Empty,
            Invitations = filtered
        });
    }

    [HttpPost("create")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create([FromForm] string email, [FromForm] string role, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        await _invitationService.CreateInvite(userCtx, activeOrgId, email, role, ct);
        return RedirectToAction(nameof(Index));
    }

    [HttpPost("revoke")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Revoke([FromForm] Guid invitationId, CancellationToken ct)
    {
        var (userCtx, activeOrgId) = await ResolveContext(ct);
        await _invitationService.RevokeInvite(userCtx, activeOrgId, invitationId, ct);
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
