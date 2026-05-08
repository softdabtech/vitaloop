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
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        IUserContextAccessor userContextAccessor,
        MembershipService membershipService,
        ILogger<DashboardController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _membershipService = membershipService;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        var (users, overview, runtimeReadiness, logs, warnings) = await LoadDashboardData(userCtx, ct);

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
            LastUpdatedAt = overview?.GeneratedAt ?? DateTimeOffset.UtcNow,
            RuntimeReadiness = new OpsRuntimeReadinessViewModel
            {
                Available = runtimeReadiness is not null,
                Ok = runtimeReadiness?.Ok ?? false,
                MissingCount = runtimeReadiness?.MissingCount ?? 0,
                WarningCount = runtimeReadiness?.Warnings.Count ?? 0,
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
                Age = u.Age,
                Sex = u.Sex,
                GlobalRole = u.GlobalRole,
                OrgRole = "-",
                MembershipStatus = u.Status,
                SubscriptionStatus = u.Status
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

    [HttpGet("live-snapshot")]
    public async Task<IActionResult> LiveSnapshot(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetOrThrow(ct);
        var (users, overview, runtimeReadiness, _, warnings) = await LoadDashboardData(userCtx, ct, includeLogs: false);

        return Json(new
        {
            totalUsers = overview?.TotalUsers ?? users.Count,
            totalOrganizations = overview?.TotalOrganizations ?? 0,
            activePrograms = overview?.ActivePrograms ?? 0,
            newRegistrations24h = overview?.NewRegistrations24h ?? 0,
            lastUpdatedAt = (overview?.GeneratedAt ?? DateTimeOffset.UtcNow).ToString("O"),
            runtimeReadiness = new
            {
                available = runtimeReadiness is not null,
                ok = runtimeReadiness?.Ok ?? false,
                missingCount = runtimeReadiness?.MissingCount ?? 0,
                warningCount = runtimeReadiness?.Warnings.Count ?? 0,
                limiterBackend = runtimeReadiness?.RateLimiter?.Backend ?? "unknown",
                limiterOk = runtimeReadiness?.RateLimiter?.Ok ?? false,
                redisRequired = runtimeReadiness?.RateLimiter?.Redis?.Required ?? false,
                redisConfigured = runtimeReadiness?.RateLimiter?.Redis?.Configured ?? false,
                redisReachable = runtimeReadiness?.RateLimiter?.Redis?.Reachable,
                redisReason = runtimeReadiness?.RateLimiter?.Redis?.Reason ?? "n/a",
            },
            warnings,
        });
    }

    [HttpPost("users/{userId}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateUser(Guid userId, [FromForm] string? fullName, [FromForm] string? globalRole, [FromForm] string? subscriptionStatus, CancellationToken ct)
    {
        try
        {
            var userCtx = await _userContextAccessor.GetOrThrow(ct);
            await _membershipService.UpdateGlobalUser(userCtx, userId, fullName, globalRole, subscriptionStatus, ct);
            TempData["SuccessMessage"] = "Global user updated.";
        }
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "Insufficient permissions.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update global user {UserId}", userId);
            TempData["ErrorMessage"] = "Failed to update global user.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost("users/{userId}/subscription")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateSubscription(Guid userId, [FromForm] string subscriptionStatus, CancellationToken ct)
    {
        try
        {
            var userCtx = await _userContextAccessor.GetOrThrow(ct);
            await _membershipService.UpdateGlobalUserSubscription(userCtx, userId, subscriptionStatus, ct);
            TempData["SuccessMessage"] = "User tariff plan updated.";
        }
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "Insufficient permissions.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update subscription status for user {UserId}", userId);
            TempData["ErrorMessage"] = "Failed to update user tariff plan.";
        }

        return RedirectToAction(nameof(Index));
    }

    private async Task<(
        IReadOnlyList<GlobalUser> Users,
        Vitaloop.Crm.Web.Models.Crm.PlatformOverview? Overview,
        Vitaloop.Crm.Web.Models.Crm.RuntimeReadinessSnapshot? RuntimeReadiness,
        IReadOnlyList<Vitaloop.Crm.Web.Models.Crm.AuditLogEntry> Logs,
        List<string> Warnings)> LoadDashboardData(
            Vitaloop.Crm.Web.Models.Auth.UserContext userCtx,
            CancellationToken ct,
            bool includeLogs = true)
    {
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

        if (includeLogs)
        {
            try
            {
                logs = await _membershipService.GetAuditLogs(userCtx, null, 20, ct);
            }
            catch (HttpRequestException)
            {
                warnings.Add("Activity log is temporarily unavailable.");
            }
        }

        return (users, overview, runtimeReadiness, logs, warnings);
    }
}
