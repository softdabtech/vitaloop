using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Contracts;

public interface IUserContextAccessor
{
    Task<UserContext?> GetCurrent(CancellationToken ct = default);
    Task<UserContext> GetOrThrow(CancellationToken ct = default);
}

