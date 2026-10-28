using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Stubs;

public sealed class StubUserContextService : IUserContextService
{
    public Task<string> GetDisplayNameAsync(CancellationToken ct = default)
    {
        return Task.FromResult("VITALOOP User");
    }
}
