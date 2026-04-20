namespace Vitaloop.Crm.Web.ViewModels;

public sealed class MemberViewModel
{
    public Guid UserId { get; init; }
    public string Email { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public int? Age { get; init; }
    public string? Sex { get; init; }
    public string GlobalRole { get; init; } = string.Empty;
    public string OrgRole { get; init; } = string.Empty;
    public string MembershipStatus { get; init; } = string.Empty;
    public string SubscriptionStatus { get; init; } = string.Empty;

    public string DisplayName => string.IsNullOrWhiteSpace(FullName) ? Email : FullName;
    public string RoleLabel => $"{GlobalRole} / {OrgRole}";
    public string StatusBadge => string.IsNullOrWhiteSpace(MembershipStatus) ? "unknown" : MembershipStatus;
}
