namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OrganizationViewModel
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string OwnerName { get; init; } = string.Empty;

    public string DisplayName => string.IsNullOrWhiteSpace(Slug) ? Name : $"{Name} ({Slug})";
    public string RoleLabel => string.IsNullOrWhiteSpace(OwnerName) ? "Owner: n/a" : $"Owner: {OwnerName}";
    public string StatusBadge => string.IsNullOrWhiteSpace(Status) ? "unknown" : Status;
}
