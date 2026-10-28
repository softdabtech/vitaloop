using Microsoft.Extensions.Logging;
using Vitaloop.Crm.Web.Models.Auth;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Auth;

// Temporary adapter — replace with a DB-backed IUserContextDataSource before production deploy.
public sealed class NullUserContextDataSource : IUserContextDataSource
{
    private readonly ILogger<NullUserContextDataSource> _logger;
    private long _callCount;

    public NullUserContextDataSource(ILogger<NullUserContextDataSource> logger)
    {
        _logger = logger;
    }

    public Task<UserContextRecord?> GetByUserAsync(Guid userId, string email, CancellationToken ct = default)
    {
        var callNumber = Interlocked.Increment(ref _callCount);
        _logger.LogCritical(
              "[STARTUP BLOCKER] NullUserContextDataSource active (call #{CallNumber}) for {UserId} ({Email}). " +
              "Wire a real IUserContextDataSource before production deploy.",
            callNumber,
            userId,
            email);
        return Task.FromResult<UserContextRecord?>(null);
    }
}
