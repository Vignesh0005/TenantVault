using Npgsql;
using TenantVault.Tests.Infrastructure;

namespace TenantVault.Tests.RlsTests;

/// <summary>Talks to PostgreSQL directly as the app role: no EF, no query filters, only RLS.</summary>
[Collection(ApiCollection.Name)]
public sealed class RowLevelSecurityTests
{
    private readonly ApiFixture _fixture;

    public RowLevelSecurityTests(ApiFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task Raw_select_without_tenant_context_returns_zero_rows()
    {
        await using var connection = await OpenAppConnectionAsync();

        foreach (var table in new[] { "products", "stock_movements", "audit_entries" })
        {
            Assert.Equal(0L, await ScalarAsync<long>(connection, $"SELECT count(*) FROM {table}"));
        }
    }

    [DockerFact]
    public async Task Tenant_context_exposes_only_that_tenants_rows()
    {
        var acmeId = await TenantIdAsync("acme-corp");
        await using var connection = await OpenAppConnectionAsync();
        await ExecuteAsync(connection, $"SELECT set_config('app.tenant_id', '{acmeId}', false)");

        Assert.True(await ScalarAsync<long>(connection, "SELECT count(*) FROM products") >= 10);
        Assert.Equal(0L, await ScalarAsync<long>(connection, $"SELECT count(*) FROM products WHERE tenant_id <> '{acmeId}'"));
    }

    [DockerFact]
    public async Task Insert_for_another_tenant_violates_policy()
    {
        var acmeId = await TenantIdAsync("acme-corp");
        var globexId = await TenantIdAsync("globex-ltd");
        await using var connection = await OpenAppConnectionAsync();
        await ExecuteAsync(connection, $"SELECT set_config('app.tenant_id', '{acmeId}', false)");

        var ex = await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(connection, $"""
            INSERT INTO products (id, tenant_id, sku, name, price, quantity, created_at, updated_at)
            VALUES ('{Guid.NewGuid()}', '{globexId}', 'RLS-TEST', 'Smuggled', 1, 1, now(), now())
            """));
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, ex.SqlState);
    }

    [DockerFact]
    public async Task App_role_is_not_superuser_and_cannot_bypass_rls()
    {
        await using var connection = await OpenAppConnectionAsync();
        Assert.False(await ScalarAsync<bool>(connection, "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user"));
        Assert.True(await ScalarAsync<bool>(connection, "SELECT relforcerowsecurity FROM pg_class WHERE relname = 'products'"));
    }

    private async Task<NpgsqlConnection> OpenAppConnectionAsync()
    {
        var connection = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(_fixture.AppConnectionString) { Pooling = false }.ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    private async Task<Guid> TenantIdAsync(string slug)
    {
        await using var connection = new NpgsqlConnection(_fixture.OwnerConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT id FROM tenants WHERE slug = @slug", connection);
        command.Parameters.AddWithValue("slug", slug);
        return (Guid)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<T> ScalarAsync<T>(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        return (T)(await command.ExecuteScalarAsync())!;
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}
