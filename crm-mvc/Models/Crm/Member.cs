namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class Member
{
    public Guid UserId { get; init; }
    public string Email { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string GlobalRole { get; init; } = "end_user";
    public string OrgRole { get; init; } = "end_user";
    public string MembershipStatus { get; init; } = "active";
    public bool SubscriptionActive { get; init; }
    public string SubscriptionStatus { get; init; } = "inactive";
}

public sealed class GlobalUser
{
    public Guid UserId { get; init; }
    public string Email { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string GlobalRole { get; init; } = "end_user";
    public string Status { get; init; } = "active";
}
