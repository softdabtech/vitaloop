namespace Vitaloop.Crm.Web.Models.Auth;

// Projection loaded from the backend /auth/me endpoint via IUserContextDataSource.
public sealed class UserContextRecord
{
    public string? GlobalRole { get; init; }
    public bool? OnboardingCompleted { get; init; }
    public bool? SubscriptionActive { get; init; }
    public string? SubscriptionStatus { get; init; }
    public IReadOnlyList<Membership>? Memberships { get; init; }
    public PendingInvite? PendingInvite { get; init; }
}
