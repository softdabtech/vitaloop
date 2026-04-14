namespace Vitaloop.Crm.Web.Services.Contracts;

public interface IAuthService
{
    Task<bool> SignInAsync(string email, string password, CancellationToken ct = default);
}
