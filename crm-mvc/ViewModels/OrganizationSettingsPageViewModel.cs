namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OrganizationSettingsPageViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public OrganizationViewModel? Organization { get; init; }
    public string TimeZone { get; init; } = "UTC";
    public string BillingEmail { get; init; } = string.Empty;
    public string SupportEmail { get; init; } = string.Empty;
    public bool IsLocked { get; init; }
}
