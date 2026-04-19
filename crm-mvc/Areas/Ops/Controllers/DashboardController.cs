using System.Net.Http;
using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Ops.Controllers;

[Area("Ops")]
[Route("ops")]
[RequireGlobalRole("super_admin")]
public class DashboardController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly MembershipService _membershipService;

    public DashboardController(IUserContextAccessor userContextAccessor, MembershipService membershipService)
    {
        _userContextAccessor = userContextAccessor;
        _membershipService = membershipService;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        var warnings = new List<string>();

        IReadOnlyList<GlobalUser> users = Array.Empty<GlobalUser>();
        Vitaloop.Crm.Web.Models.Crm.PlatformOverview? overview = null;
        Vitaloop.Crm.Web.Models.Crm.RuntimeReadinessSnapshot? runtimeReadiness = null;
        IReadOnlyList<Vitaloop.Crm.Web.Models.Crm.AuditLogEntry> logs = Array.Empty<Vitaloop.Crm.Web.Models.Crm.AuditLogEntry>();

        try
        {
            users = await _membershipService.GetGlobalUsers(userCtx, ct);
        }
        catch (HttpRequestException)
        {
            warnings.Add("Global users feed is temporarily unavailable.");
        }

        try
        {
            overview = await _membershipService.GetPlatformOverview(userCtx, ct);
        }
        catch (HttpRequestException)
        {
            warnings.Add("Platform overview is temporarily unavailable.");
        }

        try
        {
            runtimeReadiness = await _membershipService.GetRuntimeReadiness(userCtx, ct);
        }
        catch (HttpRequestException)
        {
            warnings.Add("Runtime readiness is temporarily unavailable.");
        }

        try
        {
            logs = await _membershipService.GetAuditLogs(userCtx, null, 20, ct);
        }
        catch (HttpRequestException)
        {
            warnings.Add("Activity log is temporarily unavailable.");
        }

        if (warnings.Count > 0)
        {
            TempData["WarningMessage"] = string.Join(" ", warnings);
        }

        var model = new OpsDashboardViewModel
        {
            TotalUsers = overview?.TotalUsers ?? users.Count,
            TotalOrganizations = overview?.TotalOrganizations ?? 0,
            ActivePrograms = overview?.ActivePrograms ?? 0,
            NewRegistrations24h = overview?.NewRegistrations24h ?? 0,
            RuntimeReadiness = new OpsRuntimeReadinessViewModel
            {
                Available = runtimeReadiness is not null,
                Ok = runtimeReadiness?.Ok ?? false,
                MissingCount = runtimeReadiness?.MissingCount ?? 0,
                LimiterBackend = runtimeReadiness?.RateLimiter?.Backend ?? "unknown",
                LimiterOk = runtimeReadiness?.RateLimiter?.Ok ?? false,
                RedisRequired = runtimeReadiness?.RateLimiter?.Redis?.Required ?? false,
                RedisConfigured = runtimeReadiness?.RateLimiter?.Redis?.Configured ?? false,
                RedisReachable = runtimeReadiness?.RateLimiter?.Redis?.Reachable,
                RedisReason = runtimeReadiness?.RateLimiter?.Redis?.Reason ?? "n/a",
            },
            GlobalUsers = users.Select(u => new MemberViewModel
            {
                UserId = u.UserId,
                Email = u.Email,
                FullName = u.FullName,
                GlobalRole = u.GlobalRole,
                OrgRole = "-",
                MembershipStatus = u.Status,
                SubscriptionStatus = "-"
            }).ToList(),
            RecentAuditLogs = logs.Select(l => new OpsAuditLogViewModel
            {
                Id = l.Id,
                UserId = l.UserId,
                Action = l.Action,
                EntityType = l.EntityType,
                EntityId = l.EntityId,
                OrganizationId = l.OrganizationId,
                Timestamp = l.Timestamp,
            }).ToList()
        };

        return View(model);
    }
}
