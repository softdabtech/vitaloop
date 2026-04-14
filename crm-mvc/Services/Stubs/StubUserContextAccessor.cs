using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Stubs;

public sealed class StubUserContextAccessor : IUserContextAccessor
{
    public Task<UserContext?> GetCurrent(CancellationToken ct = default)
    {
        return Task.FromResult<UserContext?>(new UserContext
        {
            UserId = Guid.Empty,
            Email = "foundation@vitaloop.local",
            GlobalRole = "end_user",
            OnboardingCompleted = false,
            SubscriptionActive = false,
            SubscriptionStatus = "inactive",
            ActiveOrganizationId = null,
            Memberships = Array.Empty<Membership>(),
            PendingInvite = null
        });
    }

    public async Task<UserContext> GetOrThrow(CancellationToken ct = default)
    {
        return (await GetCurrent(ct))!;
    }
}
