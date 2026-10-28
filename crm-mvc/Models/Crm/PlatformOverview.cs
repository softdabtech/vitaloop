using System.Text.Json.Serialization;

namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class PlatformOverview
{
    [JsonPropertyName("total_users")]
    public int TotalUsers { get; init; }

    [JsonPropertyName("total_organizations")]
    public int TotalOrganizations { get; init; }

    [JsonPropertyName("active_programs")]
    public int ActivePrograms { get; init; }

    [JsonPropertyName("new_registrations_24h")]
    public int NewRegistrations24h { get; init; }

    [JsonPropertyName("generated_at")]
    public DateTimeOffset? GeneratedAt { get; init; }
}
