using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Contracts;

public interface IUserContextDataSource
{
    Task<UserContextRecord?> GetByUserAsync(Guid userId, string email, CancellationToken ct = default);
}
