namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class Invitation
{
    public Guid Id { get; init; }
    public string Email { get; init; } = string.Empty;
    public string Role { get; init; } = "end_user";
    public string Status { get; init; } = "sent";
    public DateTimeOffset? ExpiresAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}
