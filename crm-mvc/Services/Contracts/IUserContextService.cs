namespace Vitaloop.Crm.Web.Services.Contracts;

public interface IUserContextService
{
    Task<string> GetDisplayNameAsync(CancellationToken ct = default);
}
