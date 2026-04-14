namespace Vitaloop.Crm.Web.ViewModels;

public sealed class InvitationViewModel
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset? ExpiresAt { get; init; }

    public string DisplayName => Email;
    public string RoleLabel => string.IsNullOrWhiteSpace(Role) ? "end_user" : Role;
    public string StatusBadge => string.IsNullOrWhiteSpace(Status) ? "unknown" : Status;
    public string ExpiresLabel => ExpiresAt?.ToString("yyyy-MM-dd") ?? "-";
}
