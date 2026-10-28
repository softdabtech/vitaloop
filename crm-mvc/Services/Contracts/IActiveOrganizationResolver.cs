using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Contracts;

public interface IActiveOrganizationResolver
{
    Task<Guid?> GetActiveOrganizationId(
        UserContext userContext,
        Guid? routeOrQueryOrganizationId = null,
        CancellationToken ct = default);

    Task SetActiveOrganizationId(Guid organizationId, CancellationToken ct = default);
}

