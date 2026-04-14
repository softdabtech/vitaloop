using Microsoft.Extensions.Options;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Services.Auth;

public sealed class AuthStartupBlockersHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IOptions<AuthOptions> _authOptions;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AuthStartupBlockersHostedService> _logger;

    public AuthStartupBlockersHostedService(
        IServiceProvider serviceProvider,
        IOptions<AuthOptions> authOptions,
        IWebHostEnvironment environment,
        ILogger<AuthStartupBlockersHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _authOptions = authOptions;
        _environment = environment;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var options = _authOptions.Value;

        var missingIssuer = string.IsNullOrWhiteSpace(options.Issuer);
        var missingAudience = string.IsNullOrWhiteSpace(options.Audience);
        var missingSigningKey = string.IsNullOrWhiteSpace(options.JwtPublicKey);

        if (missingIssuer || missingAudience || missingSigningKey)
        {
            const string message = "BLOCKER: JWT validation config is incomplete. Required: Auth:Issuer, Auth:Audience, Auth:JwtPublicKey.";
            _logger.LogCritical(message);

            if (!_environment.IsDevelopment())
            {
                throw new InvalidOperationException(message);
            }
        }

        using var scope = _serviceProvider.CreateScope();
        var dataSource = scope.ServiceProvider.GetRequiredService<IUserContextDataSource>();
        if (dataSource is NullUserContextDataSource)
        {
            const string message = "BLOCKER: NullUserContextDataSource is active. Replace with DB-backed implementation before production deploy.";
            _logger.LogCritical(message);

            if (!_environment.IsDevelopment())
            {
                throw new InvalidOperationException(message);
            }
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
