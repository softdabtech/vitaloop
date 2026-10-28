using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;

namespace Vitaloop.Crm.Web.Services.Invitations;

public sealed class InvitationService
{
    private readonly ICrmDataGateway _gateway;
    private readonly IAccessPolicyService _accessPolicyService;

    public InvitationService(ICrmDataGateway gateway, IAccessPolicyService accessPolicyService)
    {
        _gateway = gateway;
        _accessPolicyService = accessPolicyService;
    }

    public async Task<IReadOnlyList<Invitation>> GetInvitations(UserContext userCtx, Guid orgId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.CanAccessOrg(userCtx, orgId))
        {
            throw new UnauthorizedAccessException("Invitations access denied.");
        }

        return await _gateway.GetInvitations(orgId, ct);
    }

    public async Task<Invitation?> CreateInvite(UserContext userCtx, Guid orgId, string email, string role, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
        {
            throw new UnauthorizedAccessException("Create invite denied.");
        }

        return await _gateway.CreateInvite(orgId, email, role, ct);
    }

    public async Task RevokeInvite(UserContext userCtx, Guid orgId, Guid invitationId, CancellationToken ct = default)
    {
        if (!_accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin"))
        {
            throw new UnauthorizedAccessException("Revoke invite denied.");
        }

        await _gateway.RevokeInvite(orgId, invitationId, ct);
    }

    public async Task AcceptInvite(UserContext userCtx, string token, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ArgumentException("Invitation token is required.", nameof(token));
        }

        await _gateway.AcceptInvite(token, ct);
    }
}
