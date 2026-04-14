namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class Organization
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Status { get; init; } = "active";
    public string OwnerName { get; init; } = string.Empty;
}

public sealed class OrganizationSettings
{
    public Guid OrganizationId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string TimeZone { get; init; } = "UTC";
    public string BillingEmail { get; init; } = string.Empty;
    public string SupportEmail { get; init; } = string.Empty;
    public bool IsLocked { get; init; }
}

public sealed class UpdateOrganizationRequest
{
    public string Name { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
}
