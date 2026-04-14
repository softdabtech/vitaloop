namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class RequestUserContext
{
    public required Guid UserId { get; init; }
    public required string Email { get; init; }
    public required string GlobalRole { get; init; }
    public Guid? ActiveOrganizationId { get; init; }
    public string? ActiveOrganizationRole { get; init; }
    public bool SubscriptionActive { get; init; }
}
