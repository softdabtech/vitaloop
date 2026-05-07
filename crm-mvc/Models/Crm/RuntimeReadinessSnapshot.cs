using System.Text.Json.Serialization;

namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class RuntimeReadinessSnapshot
{
    [JsonPropertyName("ok")]
    public bool Ok { get; init; }

    [JsonPropertyName("missing_count")]
    public int MissingCount { get; init; }

    [JsonPropertyName("missing")]
    public IReadOnlyList<string> Missing { get; init; } = Array.Empty<string>();

    [JsonPropertyName("warnings")]
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();

    [JsonPropertyName("rate_limiter")]
    public RuntimeRateLimiterStatus? RateLimiter { get; init; }
}

public sealed class RuntimeRateLimiterStatus
{
    [JsonPropertyName("backend")]
    public string Backend { get; init; } = string.Empty;

    [JsonPropertyName("ok")]
    public bool Ok { get; init; }

    [JsonPropertyName("redis")]
    public RuntimeRateLimiterRedisStatus? Redis { get; init; }
}

public sealed class RuntimeRateLimiterRedisStatus
{
    [JsonPropertyName("required")]
    public bool Required { get; init; }

    [JsonPropertyName("configured")]
    public bool Configured { get; init; }

    [JsonPropertyName("reachable")]
    public bool? Reachable { get; init; }

    [JsonPropertyName("reason")]
    public string? Reason { get; init; }
}
