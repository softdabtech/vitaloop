namespace Vitaloop.Crm.Web.ViewModels;

public sealed class AssignmentViewModel
{
    public Guid Id { get; init; }
    public Guid OrganizationId { get; init; }
    public Guid ClientId { get; init; }
    public string ClientName { get; init; } = string.Empty;
    public Guid PractitionerId { get; init; }
    public string PractitionerName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Notes { get; init; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; init; }

    public string DisplayName => $"{PractitionerName} -> {ClientName}";
    public string RoleLabel => "practitioner assignment";
    public string StatusBadge => string.IsNullOrWhiteSpace(Status) ? "unknown" : Status;
}
