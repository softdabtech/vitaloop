namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OpsDashboardViewModel
{
    public IReadOnlyList<MemberViewModel> GlobalUsers { get; init; } = Array.Empty<MemberViewModel>();
    public int TotalUsers { get; init; }
    public int TotalOrganizations { get; init; }
    public int ActivePrograms { get; init; }
    public int NewRegistrations24h { get; init; }
    public IReadOnlyList<OpsAuditLogViewModel> RecentAuditLogs { get; init; } = Array.Empty<OpsAuditLogViewModel>();
    public OpsRuntimeReadinessViewModel RuntimeReadiness { get; init; } = new();
}

public sealed class OpsRuntimeReadinessViewModel
{
    public bool Available { get; init; }
    public bool Ok { get; init; }
    public string LimiterBackend { get; init; } = "unknown";
    public bool LimiterOk { get; init; }
    public bool RedisRequired { get; init; }
    public bool RedisConfigured { get; init; }
    public bool? RedisReachable { get; init; }
    public string RedisReason { get; init; } = "n/a";
    public int MissingCount { get; init; }
    public int WarningCount { get; init; }
}

public sealed class OpsAuditLogViewModel
{
    public Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string Action { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public string EntityId { get; init; } = string.Empty;
    public Guid? OrganizationId { get; init; }
    public DateTimeOffset Timestamp { get; init; }
}
