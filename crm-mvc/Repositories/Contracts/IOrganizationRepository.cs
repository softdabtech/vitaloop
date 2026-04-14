namespace Vitaloop.Crm.Web.Repositories.Contracts;

public interface IOrganizationRepository
{
    Task<bool> ExistsAsync(Guid organizationId, CancellationToken ct = default);
}
