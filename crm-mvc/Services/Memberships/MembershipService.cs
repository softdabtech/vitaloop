using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;

namespace Vitaloop.Crm.Web.Services.Memberships;

public sealed class MembershipService
{
    private readonly ICrmDataGateway _gateway;
    private readonly IAccessPolicyService _accessPolicyService;

    public MembershipService(ICrmDataGateway gateway, IAccessPolicyService accessPolicyService)
    {
        _gateway = gateway;
        _accessPolicyService = accessPolicyService;
    }

    public async Task<IReadOnlyList<Member>> GetMembers(UserContext userCtx, Guid orgId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.CanAccessOrg(userCtx, orgId))
        {
            throw new UnauthorizedAccessException("Members access denied.");
        }

        var members = await _gateway.GetMembers(orgId, ct);
        return members
            .Where(m => !string.Equals(m.MembershipStatus, "removed", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    public async Task ChangeRole(UserContext userCtx, Guid orgId, Guid userId, string role, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
        {
            throw new UnauthorizedAccessException("Change role denied.");
        }

        await _gateway.ChangeRole(orgId, userId, role, ct);
    }

    public async Task RemoveMember(UserContext userCtx, Guid orgId, Guid userId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
        {
            throw new UnauthorizedAccessException("Remove member denied.");
        }

        await _gateway.RemoveMember(orgId, userId, ct);
    }

    public async Task<IReadOnlyList<GlobalUser>> GetGlobalUsers(UserContext userCtx, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            throw new UnauthorizedAccessException("Global users access denied.");
        }

        return await _gateway.GetGlobalUsers(ct);
    }

    public async Task<PlatformOverview?> GetPlatformOverview(UserContext userCtx, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            throw new UnauthorizedAccessException("Platform overview access denied.");
        }

        return await _gateway.GetPlatformOverview(ct);
    }

    public async Task<IReadOnlyList<AuditLogEntry>> GetAuditLogs(UserContext userCtx, Guid? organizationId = null, int limit = 200, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            throw new UnauthorizedAccessException("Audit log access denied.");
        }

        return await _gateway.GetAuditLogs(organizationId, limit, ct);
    }

    public async Task<RuntimeReadinessSnapshot?> GetRuntimeReadiness(UserContext userCtx, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            throw new UnauthorizedAccessException("Runtime readiness access denied.");
        }

        return await _gateway.GetRuntimeReadiness(ct);
    }
}
