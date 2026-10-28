using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Stubs;

public sealed class StubInvitationService : IInvitationService
{
    public Task<int> GetPendingCountAsync(CancellationToken ct = default)
    {
        return Task.FromResult(0);
    }
}
