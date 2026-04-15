using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Auth;

namespace Vitaloop.Crm.Web.Services.Data;

public sealed class HttpCrmDataGateway : ICrmDataGateway
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly CrmDataOptions _options;
    private readonly AuthOptions _authOptions;

    public HttpCrmDataGateway(
        IHttpClientFactory httpClientFactory,
        IHttpContextAccessor httpContextAccessor,
        IOptions<CrmDataOptions> options,
        IOptions<AuthOptions> authOptions)
    {
        _httpClientFactory = httpClientFactory;
        _httpContextAccessor = httpContextAccessor;
        _options = options.Value;
        _authOptions = authOptions.Value;
    }

    public Task<Organization?> CreateOrganization(
        Guid ownerId,
        string name,
        string slug,
        string status,
        string? description,
        string? logoUrl,
        CancellationToken ct = default)
        => SendAndRead<Organization>(
            HttpMethod.Post,
            _options.OrganizationsPath,
            new
            {
                owner_id = ownerId,
                name,
                slug,
                status,
                description,
                logo_url = logoUrl,
            },
            ct);

    public Task<IReadOnlyList<Organization>> GetOrganizations(CancellationToken ct = default)
        => GetList<Organization>(_options.OrganizationsPath, ct);

    public Task<Organization?> GetOrganization(Guid orgId, CancellationToken ct = default)
        => GetSingle<Organization>($"{_options.OrganizationsPath}/{orgId}", ct);

    public Task<OrganizationSettings?> GetOrganizationSettings(Guid orgId, CancellationToken ct = default)
        => GetSingle<OrganizationSettings>(ResolveOrgSettingsPath(orgId), ct);

    public Task UpdateOrganization(Guid orgId, UpdateOrganizationRequest request, CancellationToken ct = default)
        => SendWithoutResponse(HttpMethod.Put, $"{_options.OrganizationsPath}/{orgId}", request, ct);

    public Task<IReadOnlyList<Member>> GetMembers(Guid orgId, CancellationToken ct = default)
        => GetList<Member>(WithOrg(_options.MembersPath, orgId), ct);

    public Task ChangeRole(Guid orgId, Guid userId, string role, CancellationToken ct = default)
        => SendWithoutResponse(new HttpMethod("PATCH"), $"{_options.MembersPath}/{userId}/role", new { org_id = orgId, role }, ct);

    public Task RemoveMember(Guid orgId, Guid userId, CancellationToken ct = default)
        => SendWithoutResponse(HttpMethod.Delete, WithOrg($"{_options.MembersPath}/{userId}", orgId), null, ct);

    public Task<IReadOnlyList<Invitation>> GetInvitations(Guid orgId, CancellationToken ct = default)
        => GetList<Invitation>(WithOrg(_options.InvitationsPath, orgId), ct);

    public Task<Invitation?> CreateInvite(Guid orgId, string email, string role, CancellationToken ct = default)
        => SendAndRead<Invitation>(HttpMethod.Post, _options.InvitationsPath, new { org_id = orgId, email, role }, ct);

    public Task RevokeInvite(Guid orgId, Guid invitationId, CancellationToken ct = default)
        => SendWithoutResponse(HttpMethod.Delete, WithOrg($"{_options.InvitationsPath}/{invitationId}", orgId), null, ct);

    public Task AcceptInvite(string token, CancellationToken ct = default)
        => SendWithoutResponse(HttpMethod.Post, $"{_options.InvitationsPath}/accept", new { token }, ct);

    public Task<IReadOnlyList<Assignment>> GetAssignments(Guid orgId, CancellationToken ct = default)
        => GetList<Assignment>(WithOrg(_options.AssignmentsPath, orgId), ct);

    public Task Assign(Guid orgId, Guid clientId, Guid practitionerId, CancellationToken ct = default)
        => SendWithoutResponse(HttpMethod.Post, _options.AssignmentsPath, new { org_id = orgId, client_id = clientId, practitioner_id = practitionerId }, ct);

    public Task Reassign(Guid orgId, Guid assignmentId, Guid practitionerId, CancellationToken ct = default)
        => SendWithoutResponse(new HttpMethod("PATCH"), $"{_options.AssignmentsPath}/{assignmentId}", new { org_id = orgId, practitioner_id = practitionerId }, ct);

    public Task UpdateAssignment(Guid orgId, Guid assignmentId, string? status, string? notes, CancellationToken ct = default)
        => SendWithoutResponse(
            new HttpMethod("PATCH"),
            $"{_options.AssignmentsPath}/{assignmentId}",
            new { org_id = orgId, status, notes },
            ct);

    public Task<IReadOnlyList<GlobalUser>> GetGlobalUsers(CancellationToken ct = default)
        => GetList<GlobalUser>(_options.GlobalUsersPath, ct);

    public Task<PlatformOverview?> GetPlatformOverview(CancellationToken ct = default)
        => GetSingle<PlatformOverview>(_options.PlatformOverviewPath, ct);

    public Task<IReadOnlyList<AuditLogEntry>> GetAuditLogs(Guid? organizationId = null, int limit = 200, CancellationToken ct = default)
    {
        var safeLimit = Math.Clamp(limit, 1, 1000);
        var path = $"{_options.AuditLogsPath}?limit={safeLimit}";
        if (organizationId.HasValue)
        {
            path += $"&organization_id={organizationId.Value}";
        }

        return GetList<AuditLogEntry>(path, ct);
    }

    private async Task<IReadOnlyList<T>> GetList<T>(string path, CancellationToken ct)
    {
        var result = await SendAndRead<List<T>>(HttpMethod.Get, path, null, ct);
        return result is null ? Array.Empty<T>() : result;
    }

    private async Task<T?> GetSingle<T>(string path, CancellationToken ct)
    {
        var response = await Send(HttpMethod.Get, path, null, ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return default;
        }

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
    }

    private async Task<T?> SendAndRead<T>(HttpMethod method, string path, object? payload, CancellationToken ct)
    {
        var response = await Send(method, path, payload, ct);
        response.EnsureSuccessStatusCode();

        if (response.Content.Headers.ContentLength == 0)
        {
            return default;
        }

        return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
    }

    private async Task SendWithoutResponse(HttpMethod method, string path, object? payload, CancellationToken ct)
    {
        var response = await Send(method, path, payload, ct);
        response.EnsureSuccessStatusCode();
    }

    private async Task<HttpResponseMessage> Send(HttpMethod method, string path, object? payload, CancellationToken ct)
    {
        var request = new HttpRequestMessage(method, BuildUri(path));
        AttachAccessToken(request);

        if (payload is not null)
        {
            request.Content = JsonContent.Create(payload);
        }

        var client = _httpClientFactory.CreateClient(nameof(HttpCrmDataGateway));
        return await client.SendAsync(request, ct);
    }

    private Uri BuildUri(string path)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            throw new InvalidOperationException("CrmData:BaseUrl is not configured.");
        }

        var baseUri = new Uri(_options.BaseUrl.TrimEnd('/') + "/");
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

    private string ResolveOrgSettingsPath(Guid orgId)
    {
        var path = _options.OrganizationSettingsPath;
        return path.Contains("{orgId}", StringComparison.Ordinal)
            ? path.Replace("{orgId}", orgId.ToString(), StringComparison.Ordinal)
            : WithOrg(path, orgId);
    }

    private static string WithOrg(string path, Guid orgId)
    {
        var separator = path.Contains('?') ? '&' : '?';
        return $"{path}{separator}org_id={orgId}";
    }
}
