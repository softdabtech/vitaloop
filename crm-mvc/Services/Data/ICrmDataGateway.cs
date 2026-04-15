using Vitaloop.Crm.Web.Models.Crm;

namespace Vitaloop.Crm.Web.Services.Data;

public interface ICrmDataGateway
{
    Task<Organization?> CreateOrganization(Guid ownerId, string name, string slug, string status, string? description, string? logoUrl, CancellationToken ct = default);
    Task<IReadOnlyList<Organization>> GetOrganizations(CancellationToken ct = default);
    Task<Organization?> GetOrganization(Guid orgId, CancellationToken ct = default);
    Task<OrganizationSettings?> GetOrganizationSettings(Guid orgId, CancellationToken ct = default);
    Task UpdateOrganization(Guid orgId, UpdateOrganizationRequest request, CancellationToken ct = default);

    Task<IReadOnlyList<Member>> GetMembers(Guid orgId, CancellationToken ct = default);
    Task ChangeRole(Guid orgId, Guid userId, string role, CancellationToken ct = default);
    Task RemoveMember(Guid orgId, Guid userId, CancellationToken ct = default);

    Task<IReadOnlyList<Invitation>> GetInvitations(Guid orgId, CancellationToken ct = default);
    Task<Invitation?> CreateInvite(Guid orgId, string email, string role, CancellationToken ct = default);
    Task RevokeInvite(Guid orgId, Guid invitationId, CancellationToken ct = default);

    Task<IReadOnlyList<Assignment>> GetAssignments(Guid orgId, CancellationToken ct = default);
    Task Assign(Guid orgId, Guid clientId, Guid practitionerId, CancellationToken ct = default);
    Task Reassign(Guid orgId, Guid assignmentId, Guid practitionerId, CancellationToken ct = default);

    Task<IReadOnlyList<GlobalUser>> GetGlobalUsers(CancellationToken ct = default);
}
