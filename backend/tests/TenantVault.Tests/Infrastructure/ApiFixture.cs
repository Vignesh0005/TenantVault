using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Testcontainers.PostgreSql;
using TenantVault.Application.DTOs.Auth;
using TenantVault.Application.Interfaces;
using TenantVault.Infrastructure.Seeding;

namespace TenantVault.Tests.Infrastructure;

/// <summary>
/// One PostgreSQL 16 container plus the real API (migrations, RLS, seed data) shared by the Docker-based tests.
/// The API connects as the least-privilege role, exactly as in docker-compose.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string AppRolePassword = "app_pw_test";

    private PostgreSqlContainer? _container;
    private WebApplicationFactory<Program>? _factory;

    public string AppConnectionString { get; private set; } = string.Empty;
    public string OwnerConnectionString { get; private set; } = string.Empty;

    public WebApplicationFactory<Program> Factory =>
        _factory ?? throw new InvalidOperationException("Docker is unavailable; the fixture was not started.");

    public async Task InitializeAsync()
    {
        if (!DockerEnvironment.IsAvailable)
        {
            return;
        }

        _container = new PostgreSqlBuilder()
            .WithImage("postgres:16")
            .WithDatabase("tenantvault")
            .WithUsername("postgres")
            .WithPassword("postgres")
            .Build();
        await _container.StartAsync();

        OwnerConnectionString = _container.GetConnectionString();
        AppConnectionString = new NpgsqlConnectionStringBuilder(OwnerConnectionString)
        {
            Username = DatabaseSeeder.AppRoleName,
            Password = AppRolePassword,
            // A tiny pool makes connection reuse across tenants (the leak scenario) near certain.
            MaxPoolSize = 2,
        }.ConnectionString;

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = AppConnectionString,
                ["ConnectionStrings:Migrations"] = OwnerConnectionString,
                ["JWT_SECRET"] = "integration-test-secret-that-is-at-least-32-bytes!",
                ["Seed:Enabled"] = "true",
                ["RateLimiting:AuthPerMinute"] = "1000",
                ["RateLimiting:SimulatorPerMinute"] = "1000",
                ["RateLimiting:GlobalPerMinute"] = "10000",
            }));
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IFileStorage>();
                services.AddSingleton<IFileStorage, FakeFileStorage>();
            });
        });

        // Starting the server runs migrations and seeding.
        _ = _factory.Server;
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    public async Task<(HttpClient Client, AuthResponse Auth)> LoginAsync(string email, string? tenant = null)
    {
        var client = Factory.CreateClient();
        var response = await client.PostAsJsonAsync("/auth/login", new LoginRequest(email, DatabaseSeeder.DemoPassword));
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>())!;

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        if (tenant is not null)
        {
            client.DefaultRequestHeaders.Add("X-Tenant-Id", tenant);
        }

        return (client, auth);
    }

    public static HttpRequestMessage Request(HttpMethod method, string path, string? tenant, object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        if (tenant is not null)
        {
            request.Headers.Add("X-Tenant-Id", tenant);
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return request;
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}
