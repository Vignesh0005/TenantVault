using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using TenantVault.Application.Services;

namespace TenantVault.Infrastructure.Persistence;

/// <summary>Used only by <c>dotnet ef</c> to build the model for migrations; never at runtime.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("TENANTVAULT_DESIGN_CONNECTION")
                               ?? "Host=localhost;Database=tenantvault;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new AppDbContext(options, new TenantProvider());
    }
}
