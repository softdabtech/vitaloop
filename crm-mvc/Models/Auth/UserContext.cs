namespace Vitaloop.Crm.Web.Models.Auth;

public sealed class UserContext
{
    public required Guid UserId { get; init; }
    public required string Email { get; init; }
    public required string GlobalRole { get; init; }
    public bool OnboardingCompleted { get; init; }
    public bool SubscriptionActive { get; init; }
    public string SubscriptionStatus { get; init; } = "inactive";
    public Guid? ActiveOrganizationId { get; set; }
    public IReadOnlyList<Membership> Memberships { get; init; } = Array.Empty<Membership>();
    public PendingInvite? PendingInvite { get; init; }
}

public sealed class Membership
{
    public required Guid OrganizationId { get; init; }
    public string OrganizationName { get; init; } = string.Empty;
    public required string Role { get; init; }
    public required string Status { get; init; }
}

public sealed class PendingInvite
{
    public required Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public Guid? OrganizationId { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
    public string Status { get; init; } = "sent";
}
