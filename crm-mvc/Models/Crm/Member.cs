using System.Text.Json.Serialization;

namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class Member
{
    public Guid UserId { get; init; }
    public string Email { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public int? Age { get; init; }
    public string? Sex { get; init; }
    public string GlobalRole { get; init; } = "end_user";
    public string OrgRole { get; init; } = "end_user";
    public string MembershipStatus { get; init; } = "active";
    public bool SubscriptionActive { get; init; }
    public string SubscriptionStatus { get; init; } = "inactive";
}

public sealed class GlobalUser
{
    [JsonPropertyName("id")]
    public Guid UserId { get; init; }

    [JsonPropertyName("email")]
    public string Email { get; init; } = string.Empty;

    [JsonPropertyName("full_name")]
    public string FullName { get; init; } = string.Empty;

    [JsonPropertyName("age")]
    public int? Age { get; init; }

    [JsonPropertyName("sex")]
    public string? Sex { get; init; }

    [JsonPropertyName("global_role")]
    public string GlobalRole { get; init; } = "end_user";

    [JsonPropertyName("sub_status")]
    public string Status { get; init; } = "active";

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }
}
