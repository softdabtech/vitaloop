using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;

namespace Vitaloop.Crm.Web.Services.Organizations;

public sealed class OrganizationService
{
    private readonly ICrmDataGateway _gateway;
    private readonly IAccessPolicyService _accessPolicyService;

    public OrganizationService(ICrmDataGateway gateway, IAccessPolicyService accessPolicyService)
    {
        _gateway = gateway;
        _accessPolicyService = accessPolicyService;
    }

    public async Task<IReadOnlyList<Organization>> GetOrganizations(UserContext userCtx, CancellationToken ct = default)
    {
        var organizations = await _gateway.GetOrganizations(ct);
        if (string.Equals(userCtx.GlobalRole, "super_admin", StringComparison.OrdinalIgnoreCase))
        {
            return organizations;
        }

        return organizations.Where(o => _accessPolicyService.CanAccessOrg(userCtx, o.Id)).ToList();
    }

    public async Task<Organization?> GetOrganization(UserContext userCtx, Guid orgId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.CanAccessOrg(userCtx, orgId))
        {
            throw new UnauthorizedAccessException("Organization access denied.");
        }

        return await _gateway.GetOrganization(orgId, ct);
    }

    public async Task UpdateOrganization(UserContext userCtx, Guid orgId, UpdateOrganizationRequest request, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
        {
            throw new UnauthorizedAccessException("Organization update denied.");
        }

        await _gateway.UpdateOrganization(orgId, request, ct);
    }

    public async Task<OrganizationSettings?> GetOrganizationSettings(UserContext userCtx, Guid orgId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.CanAccessOrg(userCtx, orgId))
        {
            throw new UnauthorizedAccessException("Organization settings access denied.");
        }

        return await _gateway.GetOrganizationSettings(orgId, ct);
    }
}
