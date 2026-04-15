namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class PlatformOverview
{
    public int TotalUsers { get; init; }
    public int TotalOrganizations { get; init; }
    public int ActivePrograms { get; init; }
    public int NewRegistrations24h { get; init; }
    public DateTimeOffset? GeneratedAt { get; init; }
}
