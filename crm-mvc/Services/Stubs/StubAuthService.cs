using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Stubs;

public sealed class StubAuthService : IAuthService
{
    public Task<bool> SignInAsync(string email, string password, CancellationToken ct = default)
    {
        return Task.FromResult(true);
    }
}
