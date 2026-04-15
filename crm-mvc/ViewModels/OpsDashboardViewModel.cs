namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OpsDashboardViewModel
{
    public IReadOnlyList<MemberViewModel> GlobalUsers { get; init; } = Array.Empty<MemberViewModel>();
    public int TotalUsers { get; init; }
    public int TotalOrganizations { get; init; }
    public int ActivePrograms { get; init; }
    public int NewRegistrations24h { get; init; }
    public IReadOnlyList<OpsAuditLogViewModel> RecentAuditLogs { get; init; } = Array.Empty<OpsAuditLogViewModel>();
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
