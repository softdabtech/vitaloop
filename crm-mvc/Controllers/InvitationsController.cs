using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Invitations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Controllers;

/// <summary>
/// 2026-09-13 CRM information-architecture cleanup: this controller used to
/// also carry Index/Create/Revoke actions (a full invitation-management
/// screen at /invitations), but nothing in the app ever linked to them — the
/// live invite flow is Areas/Admin/Controllers/UsersController's
/// Invite/SendInvite actions (/admin/members/invite), which call
/// InvitationService.CreateInvite directly. Those three actions and their
/// [RequireOrgRole] class-level gate were dead weight: a second, unreachable
/// implementation of the same screen, confusing to anyone reading the
/// codebase. Only Accept survives here — it's genuinely different (an
/// anonymous, token-based endpoint a freshly-invited user's email link points
/// at, not an authenticated org-management screen), so it keeps its own
/// un-gated route rather than moving under /admin.
/// </summary>
[Route("invitations")]
public class InvitationsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly InvitationService _invitationService;

    public InvitationsController(
        IUserContextAccessor userContextAccessor,
        InvitationService invitationService)
    {
        _userContextAccessor = userContextAccessor;
        _invitationService = invitationService;
    }

    [AllowAnonymous]
    [HttpGet("/invitations/accept")]
    public async Task<IActionResult> Accept([FromQuery] string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return Redirect("/auth/login");
        }

        var userCtx = await _userContextAccessor.GetCurrent(ct);
        if (userCtx is not null)
        {
            try
            {
                await _invitationService.AcceptInvite(userCtx, token, ct);
                TempData["SuccessMessage"] = "Invitation accepted. Organization membership activated.";
                return Redirect("/auth/post-login");
            }
            catch
            {
                TempData["ErrorMessage"] = "Invitation could not be accepted. It may be expired or invalid.";
                return Redirect("/auth/post-login");
            }
        }

        var encodedToken = WebUtility.UrlEncode(token);
        var returnUrl = WebUtility.UrlEncode($"/invitations/accept?token={encodedToken}");
        var continueUrl = $"/auth/login?returnUrl={returnUrl}";

        return View("Accept", new InvitationAcceptViewModel
        {
            Token = token,
            ContinueUrl = continueUrl,
        });
    }
}
