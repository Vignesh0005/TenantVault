using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TenantVault.Application.Interfaces;
using TenantVault.Infrastructure.Caching;
using TenantVault.Infrastructure.Persistence;
using TenantVault.Infrastructure.Persistence.Interceptors;
using TenantVault.Infrastructure.Security;
using TenantVault.Infrastructure.Storage;

namespace TenantVault.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Configures the DbContext with the tenant interceptors. Call from <c>AddDbContext</c>.</summary>
    public static void ConfigureTenantVaultDb(IServiceProvider services, DbContextOptionsBuilder options, string connectionString)
    {
        options
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .AddInterceptors(
                services.GetRequiredService<TenantSaveChangesInterceptor>(),
                services.GetRequiredService<TenantConnectionInterceptor>());
    }

    /// <summary>Registrations that support the core services listed in Program.cs.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<TenantSaveChangesInterceptor>();
        services.AddScoped<TenantConnectionInterceptor>();
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddOptions<JwtOptions>()
            .Configure<IConfiguration>((options, config) =>
            {
                config.GetSection(JwtOptions.SectionName).Bind(options);
                options.Secret = config["JWT_SECRET"] ?? options.Secret;
            })
            .Validate(o => Encoding.UTF8.GetByteCount(o.Secret) >= JwtOptions.MinimumSecretBytes,
                $"JWT_SECRET must be set and at least {JwtOptions.MinimumSecretBytes} bytes (256 bits).")
            .ValidateOnStart();

        services.Configure<S3Options>(configuration.GetSection(S3Options.SectionName));

        services.AddMemoryCache();
        services.AddScoped<ITenantCache, TenantScopedCache>();
        services.AddScoped<IIsolationSimulator, IsolationSimulator>();
        return services;
    }
}
