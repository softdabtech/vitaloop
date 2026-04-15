namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class AuditLogEntry
{
    public Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string Action { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public string EntityId { get; init; } = string.Empty;
    public Guid? OrganizationId { get; init; }
    public object? OldValue { get; init; }
    public object? NewValue { get; init; }
    public DateTimeOffset Timestamp { get; init; }
}
