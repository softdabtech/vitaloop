using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;

namespace Vitaloop.Crm.Web.Services.Auth;

public sealed class HttpUserContextDataSource : IUserContextDataSource
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly CrmDataOptions _crmOptions;
    private readonly AuthOptions _authOptions;
    private readonly ILogger<HttpUserContextDataSource> _logger;

    public HttpUserContextDataSource(
        IHttpClientFactory httpClientFactory,
        IHttpContextAccessor httpContextAccessor,
        IOptions<CrmDataOptions> crmOptions,
        IOptions<AuthOptions> authOptions,
        ILogger<HttpUserContextDataSource> logger)
    {
        _httpClientFactory = httpClientFactory;
        _httpContextAccessor = httpContextAccessor;
        _crmOptions = crmOptions.Value;
        _authOptions = authOptions.Value;
        _logger = logger;
    }

    public async Task<UserContextRecord?> GetByUserAsync(Guid userId, string email, CancellationToken ct = default)
    {
        try
        {
            var client = _httpClientFactory.CreateClient(nameof(HttpCrmDataGateway));
            using var response = await SendWithFallback(client, ct);

            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.NotFound)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            return Map(document.RootElement);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch user context via backend /auth/me for {UserId} ({Email}).", userId, email);
            return null;
        }
    }

    private async Task<HttpResponseMessage> SendWithFallback(HttpClient client, CancellationToken ct)
    {
        using var primaryRequest = new HttpRequestMessage(HttpMethod.Get, BuildUri(_crmOptions.UserContextPath));
        AttachAccessToken(primaryRequest);
        var primaryResponse = await client.SendAsync(primaryRequest, ct);
        if (primaryResponse.StatusCode != HttpStatusCode.NotFound)
        {
            return primaryResponse;
        }

        primaryResponse.Dispose();
        using var fallbackRequest = new HttpRequestMessage(HttpMethod.Get, BuildUri(_crmOptions.UserContextFallbackPath));
        AttachAccessToken(fallbackRequest);
        return await client.SendAsync(fallbackRequest, ct);
    }

    private UserContextRecord Map(JsonElement root)
    {
        var globalRole = ReadString(root, "global_role")
            ?? ReadString(root, "globalRole")
            ?? ReadNestedString(root, "user", "global_role")
            ?? ReadNestedString(root, "user", "globalRole");

        var onboarding = ReadBool(root, "onboarding_completed") ?? ReadBool(root, "onboardingCompleted");
        var subscriptionActive = ReadBool(root, "subscription_active")
            ?? ReadBool(root, "subscriptionActive")
            ?? ReadNestedBool(root, "subscription", "active");

        var subscriptionStatus = ReadString(root, "subscription_status")
            ?? ReadString(root, "subscriptionStatus")
            ?? ReadNestedString(root, "subscription", "status");

        var memberships = ReadMemberships(root);
        var pendingInvite = ReadPendingInvite(root);

        return new UserContextRecord
        {
            GlobalRole = globalRole,
            OnboardingCompleted = onboarding,
            SubscriptionActive = subscriptionActive,
            SubscriptionStatus = subscriptionStatus,
            Memberships = memberships,
            PendingInvite = pendingInvite
        };
    }

    private IReadOnlyList<Membership> ReadMemberships(JsonElement root)
    {
        if (!TryGet(root, out var membershipsRaw, "memberships") || membershipsRaw.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<Membership>();
        }

        var result = new List<Membership>();
        foreach (var item in membershipsRaw.EnumerateArray())
        {
            var orgIdRaw = ReadString(item, "organization_id")
                ?? ReadString(item, "organizationId")
                ?? ReadString(item, "org_id");

            if (!Guid.TryParse(orgIdRaw, out var orgId))
            {
                continue;
            }

            var membership = new Membership
            {
                OrganizationId = orgId,
                OrganizationName = ReadString(item, "organization_name")
                    ?? ReadString(item, "organizationName")
                    ?? string.Empty,
                Role = ReadString(item, "role") ?? "end_user",
                Status = ReadString(item, "status") ?? "active"
            };
            result.Add(membership);
        }

        return result;
    }

    private PendingInvite? ReadPendingInvite(JsonElement root)
    {
        if (!TryGet(root, out var inviteRaw, "pending_invite", "pendingInvite") || inviteRaw.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var idRaw = ReadString(inviteRaw, "id");
        if (!Guid.TryParse(idRaw, out var inviteId))
        {
            return null;
        }

        Guid? orgId = null;
        var orgIdRaw = ReadString(inviteRaw, "organization_id")
            ?? ReadString(inviteRaw, "organizationId")
            ?? ReadString(inviteRaw, "org_id");
        if (Guid.TryParse(orgIdRaw, out var parsedOrgId))
        {
            orgId = parsedOrgId;
        }

        DateTimeOffset? expiresAt = null;
        var expiresRaw = ReadString(inviteRaw, "expires_at") ?? ReadString(inviteRaw, "expiresAt");
        if (DateTimeOffset.TryParse(expiresRaw, out var parsedExpiresAt))
        {
            expiresAt = parsedExpiresAt;
        }

        return new PendingInvite
        {
            Id = inviteId,
            Email = ReadString(inviteRaw, "email") ?? string.Empty,
            Role = ReadString(inviteRaw, "role") ?? string.Empty,
            OrganizationId = orgId,
            ExpiresAt = expiresAt,
            Status = ReadString(inviteRaw, "status") ?? "sent"
        };
    }

    private Uri BuildUri(string path)
    {
        if (string.IsNullOrWhiteSpace(_crmOptions.BaseUrl))
        {
            throw new InvalidOperationException("CrmData:BaseUrl is not configured.");
        }

        var baseUri = new Uri(_crmOptions.BaseUrl.TrimEnd('/') + "/");
        var relative = path.StartsWith('/') ? path[1..] : path;
        return new Uri(baseUri, relative);
    }

    private void AttachAccessToken(HttpRequestMessage request)
    {
        var context = _httpContextAccessor.HttpContext;
        if (context is null)
        {
            return;
        }

        string? token = null;
        if (context.Request.Cookies.TryGetValue(_authOptions.TokenCookieName, out var cookieToken) && !string.IsNullOrWhiteSpace(cookieToken))
        {
            token = cookieToken;
        }
        else if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            var value = authHeader.ToString();
            if (value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                token = value["Bearer ".Length..].Trim();
            }
        }

        if (!string.IsNullOrWhiteSpace(token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
    }

    private static bool? ReadBool(JsonElement element, string property)
    {
        if (TryGet(element, out var prop, property))
        {
            if (prop.ValueKind == JsonValueKind.True)
            {
                return true;
            }

            if (prop.ValueKind == JsonValueKind.False)
            {
                return false;
            }

            if (prop.ValueKind == JsonValueKind.String && bool.TryParse(prop.GetString(), out var parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    private static bool? ReadNestedBool(JsonElement element, string objectProperty, string valueProperty)
    {
        if (!TryGet(element, out var nested, objectProperty) || nested.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return ReadBool(nested, valueProperty);
    }

    private static string? ReadString(JsonElement element, string property)
    {
        if (!TryGet(element, out var prop, property))
        {
            return null;
        }

        return prop.ValueKind == JsonValueKind.String ? prop.GetString() : prop.ToString();
    }

    private static string? ReadNestedString(JsonElement element, string objectProperty, string valueProperty)
    {
        if (!TryGet(element, out var nested, objectProperty) || nested.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return ReadString(nested, valueProperty);
    }

    private static bool TryGet(JsonElement element, out JsonElement value, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out value))
            {
                return true;
            }
        }

        value = default;
        return false;
    }
}
