using Microsoft.Extensions.Options;
using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Auth;

public sealed class ActiveOrganizationResolver : IActiveOrganizationResolver
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<ActiveOrganizationResolver> _logger;
    private readonly AuthOptions _authOptions;

    public ActiveOrganizationResolver(
        IHttpContextAccessor httpContextAccessor,
        IOptions<AuthOptions> authOptions,
        ILogger<ActiveOrganizationResolver> logger)
    {
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
        _authOptions = authOptions.Value;
    }

    public Task<Guid?> GetActiveOrganizationId(
        UserContext userContext,
        Guid? routeOrQueryOrganizationId = null,
        CancellationToken ct = default)
    {
        var activeMemberships = userContext.Memberships
            .Where(m => string.Equals(m.Status, "active", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (routeOrQueryOrganizationId.HasValue &&
            activeMemberships.Any(m => m.OrganizationId == routeOrQueryOrganizationId.Value))
        {
            return Task.FromResult<Guid?>(routeOrQueryOrganizationId.Value);
        }

        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is not null &&
            httpContext.Request.Cookies.TryGetValue(_authOptions.ActiveOrganizationCookieName, out var cookieOrgRaw) &&
            Guid.TryParse(cookieOrgRaw, out var cookieOrgId) &&
            activeMemberships.Any(m => m.OrganizationId == cookieOrgId))
        {
            return Task.FromResult<Guid?>(cookieOrgId);
        }

        var fallback = activeMemberships.FirstOrDefault()?.OrganizationId;
        if (fallback.HasValue)
        {
            _logger.LogInformation("Active organization resolved via first active membership fallback.");
        }
        return Task.FromResult(fallback);
    }

    public Task SetActiveOrganizationId(Guid organizationId, CancellationToken ct = default)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            _logger.LogWarning("SetActiveOrganizationId called without HttpContext.");
            return Task.CompletedTask;
        }

        httpContext.Response.Cookies.Append(
            _authOptions.ActiveOrganizationCookieName,
            organizationId.ToString(),
            new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Expires = DateTimeOffset.UtcNow.AddDays(30)
            });

        return Task.CompletedTask;
    }
}
