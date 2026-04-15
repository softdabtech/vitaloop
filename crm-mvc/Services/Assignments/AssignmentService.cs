using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;

namespace Vitaloop.Crm.Web.Services.Assignments;

public sealed class AssignmentService
{
    private readonly ICrmDataGateway _gateway;
    private readonly IAccessPolicyService _accessPolicyService;

    public AssignmentService(ICrmDataGateway gateway, IAccessPolicyService accessPolicyService)
    {
        _gateway = gateway;
        _accessPolicyService = accessPolicyService;
    }

    public async Task<IReadOnlyList<Assignment>> GetAssignments(UserContext userCtx, Guid orgId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.CanAccessOrg(userCtx, orgId))
        {
            throw new UnauthorizedAccessException("Assignments access denied.");
        }

        return await _gateway.GetAssignments(orgId, ct);
    }

    public async Task Assign(UserContext userCtx, Guid orgId, Guid clientId, Guid practitionerId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
        {
            throw new UnauthorizedAccessException("Assignment creation denied.");
        }

        await _gateway.Assign(orgId, clientId, practitionerId, ct);
    }

    public async Task Reassign(UserContext userCtx, Guid orgId, Guid assignmentId, Guid practitionerId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
        {
            throw new UnauthorizedAccessException("Assignment reassign denied.");
        }

        await _gateway.Reassign(orgId, assignmentId, practitionerId, ct);
    }

    public async Task UpdateAssignment(UserContext userCtx, Guid orgId, Guid assignmentId, string? status, string? notes, CancellationToken ct = default)
    {
        if (!_accessPolicyService.CanAccessOrg(userCtx, orgId))
        {
            throw new UnauthorizedAccessException("Assignment update denied.");
        }

        await _gateway.UpdateAssignment(orgId, assignmentId, status, notes, ct);
    }
}
