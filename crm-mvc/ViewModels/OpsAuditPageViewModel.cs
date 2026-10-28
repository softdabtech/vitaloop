namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OpsAuditPageViewModel
{
    public IReadOnlyList<OpsAuditLogViewModel> Logs { get; init; } = Array.Empty<OpsAuditLogViewModel>();
    public int Limit { get; init; } = 200;
    public Guid? OrganizationId { get; init; }
}
