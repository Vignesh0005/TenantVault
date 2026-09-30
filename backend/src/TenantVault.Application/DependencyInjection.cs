using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TenantVault.Application.Services;

namespace TenantVault.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<InventoryOptions>(configuration.GetSection(InventoryOptions.SectionName));
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<TenantResolver>();
        services.AddScoped<TenantService>();
        services.AddScoped<TokenService>();
        services.AddScoped<ProductService>();
        services.AddScoped<InventoryInsightsService>();
        services.AddScoped<AiAssistantService>();
        return services;
    }
}
