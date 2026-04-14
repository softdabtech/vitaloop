using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Stubs;

public sealed class StubActiveOrganizationResolver : IActiveOrganizationResolver
{
    public Task<Guid?> GetActiveOrganizationId(UserContext userContext, Guid? routeOrQueryOrganizationId = null, CancellationToken ct = default)
    {
        return Task.FromResult(routeOrQueryOrganizationId);
    }

    public Task SetActiveOrganizationId(Guid organizationId, CancellationToken ct = default)
    {
        return Task.CompletedTask;
    }
}
