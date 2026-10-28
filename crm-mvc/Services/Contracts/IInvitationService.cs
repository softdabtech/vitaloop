namespace Vitaloop.Crm.Web.Services.Contracts;

public interface IInvitationService
{
    Task<int> GetPendingCountAsync(CancellationToken ct = default);
}
