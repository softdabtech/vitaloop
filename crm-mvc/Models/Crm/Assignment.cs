namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class Assignment
{
    public Guid Id { get; init; }
    public Guid ClientId { get; init; }
    public string ClientName { get; init; } = string.Empty;
    public Guid PractitionerId { get; init; }
    public string PractitionerName { get; init; } = string.Empty;
    public string Status { get; init; } = "active";
    public DateTimeOffset UpdatedAt { get; init; }
}
