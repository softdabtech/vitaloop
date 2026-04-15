using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Auth;

public sealed class UserContextAccessor : IUserContextAccessor
{
    private const string HttpContextItemKey = "UserContext";
    private static readonly HttpClient JwksHttpClient = new();
    private static readonly object JwksLock = new();
    private static JsonWebKeySet? CachedJwks;
    private static DateTimeOffset CachedJwksAt = DateTimeOffset.MinValue;

    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IUserContextDataSource _userContextDataSource;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly ILogger<UserContextAccessor> _logger;
    private readonly AuthOptions _authOptions;

    public UserContextAccessor(
        IHttpContextAccessor httpContextAccessor,
        IUserContextDataSource userContextDataSource,
        IActiveOrganizationResolver activeOrganizationResolver,
        IOptions<AuthOptions> authOptions,
        ILogger<UserContextAccessor> logger)
    {
        _httpContextAccessor = httpContextAccessor;
        _userContextDataSource = userContextDataSource;
        _activeOrganizationResolver = activeOrganizationResolver;
        _logger = logger;
        _authOptions = authOptions.Value;
    }

    public async Task<UserContext?> GetCurrent(CancellationToken ct = default)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        if (httpContext.Items.TryGetValue(HttpContextItemKey, out var cached) && cached is UserContext cachedCtx)
        {
            return cachedCtx;
        }

        var rawToken = ExtractToken(httpContext);
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return null;
        }

        ClaimsPrincipal principal;
        JwtSecurityToken token;
        try
        {
            (principal, token) = ValidateAndReadToken(rawToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Token validation failed in UserContextAccessor.");
            return null;
        }

        var sub = principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = principal.FindFirstValue("email") ?? string.Empty;
        if (!Guid.TryParse(sub, out var userId))
        {
            _logger.LogWarning("Invalid or missing sub claim in token.");
            return null;
        }

        var baseMemberships = ParseMembershipsFromClaims(principal);
        var globalRole = principal.FindFirstValue("global_role");
        var subscriptionStatus = principal.FindFirstValue("subscription_status") ?? "inactive";

        var record = await _userContextDataSource.GetByUserAsync(userId, email, ct);

        var memberships = record?.Memberships ?? baseMemberships;
        var userCtx = new UserContext
        {
            UserId = userId,
            Email = email,
            GlobalRole = record?.GlobalRole ?? globalRole ?? "end_user",
            OnboardingCompleted = record?.OnboardingCompleted ?? ParseBoolClaim(principal, "onboarding_completed"),
            SubscriptionActive = record?.SubscriptionActive ?? ParseSubscriptionActive(subscriptionStatus),
            SubscriptionStatus = record?.SubscriptionStatus ?? subscriptionStatus,
            Memberships = memberships,
            PendingInvite = record?.PendingInvite
        };

        var hintedOrg = TryResolveHintedOrganization(httpContext);
        userCtx.ActiveOrganizationId = await _activeOrganizationResolver.GetActiveOrganizationId(userCtx, hintedOrg, ct);

        httpContext.Items[HttpContextItemKey] = userCtx;
        return userCtx;
    }

    public async Task<UserContext> GetOrThrow(CancellationToken ct = default)
    {
        var current = await GetCurrent(ct);
        if (current is null)
        {
            throw new UnauthorizedAccessException("User is not authenticated.");
        }

        return current;
    }

    private string? ExtractToken(HttpContext httpContext)
    {
        if (httpContext.Request.Cookies.TryGetValue(_authOptions.TokenCookieName, out var cookieToken)
            && !string.IsNullOrWhiteSpace(cookieToken))
        {
            return cookieToken;
        }

        if (httpContext.Request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            var value = authHeader.ToString();
            if (value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Using Authorization header fallback for JWT extraction.");
                return value["Bearer ".Length..].Trim();
            }
        }

        return null;
    }

    private (ClaimsPrincipal Principal, JwtSecurityToken Token) ValidateAndReadToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();

        var readToken = handler.ReadJwtToken(token);
        Console.WriteLine($"[CRM] jwt header alg: {readToken.Header.Alg}");
        Console.WriteLine($"[CRM] jwt header kid: {readToken.Header.Kid}");
        Console.WriteLine($"[CRM] jwt payload iss: {readToken.Issuer}");
        Console.WriteLine($"[CRM] jwt payload aud: {string.Join(',', readToken.Audiences)}");
        Console.WriteLine($"[CRM] jwt payload sub: {readToken.Subject}");

        if (string.IsNullOrWhiteSpace(_authOptions.Issuer))
        {
            throw new SecurityTokenException("Auth:Issuer must be configured for JWT validation.");
        }

        if (string.IsNullOrWhiteSpace(_authOptions.Audience))
        {
            throw new SecurityTokenException("Auth:Audience must be configured for JWT validation.");
        }

        var validations = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _authOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = _authOptions.Audience,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            ValidateIssuerSigningKey = true
        };

        validations.IssuerSigningKey = ResolveSigningKey(readToken);

        ClaimsPrincipal principal;
        SecurityToken validatedToken;
        try
        {
            principal = handler.ValidateToken(token, validations, out validatedToken);
            Console.WriteLine("[CRM] Token validated successfully");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CRM] jwt validation exception: {ex.GetType().Name}: {ex.Message}");
            throw;
        }

        if (validatedToken is not JwtSecurityToken jwt)
        {
            throw new SecurityTokenException("Validated token is not JWT.");
        }

        return (principal, jwt);
    }

    private SecurityKey ResolveSigningKey(JwtSecurityToken readToken)
    {
        if (!string.IsNullOrWhiteSpace(_authOptions.JwksUrl))
        {
            Console.WriteLine("[CRM] jwt validation branch: JWKS ES256");
            var jwks = GetJwks();
            var key = jwks.Keys.FirstOrDefault(k =>
                string.Equals(k.Kid, readToken.Header.Kid, StringComparison.Ordinal));

            if (key is null)
            {
                throw new SecurityTokenSignatureKeyNotFoundException(
                    $"No JWK found for kid '{readToken.Header.Kid}'.");
            }

            return key;
        }

        if (!string.IsNullOrWhiteSpace(_authOptions.JwtPublicKey))
        {
            Console.WriteLine("[CRM] jwt validation branch: JwtPublicKey");
            return BuildSigningKey(_authOptions.JwtPublicKey);
        }

        throw new SecurityTokenException("Auth:JwksUrl or Auth:JwtPublicKey must be configured for JWT validation.");
    }

    private JsonWebKeySet GetJwks()
    {
        var now = DateTimeOffset.UtcNow;
        lock (JwksLock)
        {
            if (CachedJwks is not null && (now - CachedJwksAt) < TimeSpan.FromMinutes(10))
            {
                return CachedJwks;
            }

            var jwksJson = JwksHttpClient.GetStringAsync(_authOptions.JwksUrl)
                .GetAwaiter()
                .GetResult();
            CachedJwks = new JsonWebKeySet(jwksJson);
            CachedJwksAt = now;
            return CachedJwks;
        }
    }

    private static bool ParseSubscriptionActive(string? status)
    {
        return string.Equals(status, "active", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ParseBoolClaim(ClaimsPrincipal principal, string claimType)
    {
        var raw = principal.FindFirstValue(claimType);
        return bool.TryParse(raw, out var result) && result;
    }

    private static IReadOnlyList<Membership> ParseMembershipsFromClaims(ClaimsPrincipal principal)
    {
        var raw = principal.FindFirstValue("memberships");
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<Membership>();
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<List<MembershipClaim>>(raw);
            if (parsed is null)
            {
                return Array.Empty<Membership>();
            }

            return parsed
                .Where(m => Guid.TryParse(m.OrganizationId, out _))
                .Select(m => new Membership
                {
                    OrganizationId = Guid.Parse(m.OrganizationId),
                    OrganizationName = m.OrganizationName ?? string.Empty,
                    Role = m.Role ?? "end_user",
                    Status = m.Status ?? "active"
                })
                .ToList();
        }
        catch
        {
            return Array.Empty<Membership>();
        }
    }

    private static Guid? TryResolveHintedOrganization(HttpContext context)
    {
        var routeValue = context.Request.RouteValues.TryGetValue("orgId", out var orgObj)
            ? orgObj?.ToString()
            : null;
        if (Guid.TryParse(routeValue, out var routeOrgId))
        {
            return routeOrgId;
        }

        var query = context.Request.Query["org_id"].ToString();
        if (Guid.TryParse(query, out var queryOrgId))
        {
            return queryOrgId;
        }

        var queryAlias = context.Request.Query["orgId"].ToString();
        if (Guid.TryParse(queryAlias, out var queryAliasOrgId))
        {
            return queryAliasOrgId;
        }

        return null;
    }

    private static SecurityKey BuildSigningKey(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.StartsWith("{", StringComparison.Ordinal) && trimmed.Contains("\"kty\"", StringComparison.Ordinal))
        {
            return new JsonWebKey(trimmed);
        }

        var rsa = RSA.Create();
        rsa.ImportFromPem(NormalizePublicKey(trimmed));
        return new RsaSecurityKey(rsa);
    }

    private static string NormalizePublicKey(string value)
    {
        if (value.Contains("BEGIN PUBLIC KEY", StringComparison.Ordinal))
        {
            return value;
        }

        var compact = value.Replace("\r", string.Empty, StringComparison.Ordinal)
            .Replace("\n", string.Empty, StringComparison.Ordinal)
            .Trim();

        var lines = Enumerable.Range(0, (compact.Length + 63) / 64)
            .Select(i => compact.Substring(i * 64, Math.Min(64, compact.Length - (i * 64))));

        return "-----BEGIN PUBLIC KEY-----\n"
            + string.Join("\n", lines)
            + "\n-----END PUBLIC KEY-----";
    }

    private sealed class MembershipClaim
    {
        public string OrganizationId { get; set; } = string.Empty;
        public string? OrganizationName { get; set; }
        public string? Role { get; set; }
        public string? Status { get; set; }
    }
}
