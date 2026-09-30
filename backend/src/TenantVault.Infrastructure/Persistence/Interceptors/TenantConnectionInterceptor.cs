using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TenantVault.Application.Interfaces;

namespace TenantVault.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Binds <c>app.tenant_id</c> (read by the PostgreSQL RLS policies) to the current tenant every time
/// EF opens a connection, and clears it before the connection goes back to the pool.
/// </summary>
/// <remarks>
/// The value is set at session level (<c>is_local = false</c>): EF runs most queries outside an explicit
/// transaction, where a transaction-local setting would expire after this single statement and every
/// following query would see no tenant. Pool leakage is prevented instead by (1) setting the value on
/// every open, (2) resetting it on close, and (3) Npgsql's DISCARD ALL when a pooled connection is reused.
/// </remarks>
public sealed class TenantConnectionInterceptor : DbConnectionInterceptor
{
    private const string SetTenantSql = "SELECT set_config('app.tenant_id', @tenant_id, false)";

    private readonly ITenantProvider _tenantProvider;

    public TenantConnectionInterceptor(ITenantProvider tenantProvider)
    {
        _tenantProvider = tenantProvider;
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = CreateCommand(connection, _tenantProvider.TenantId);
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        await using var command = CreateCommand(connection, _tenantProvider.TenantId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public override InterceptionResult ConnectionClosing(DbConnection connection, ConnectionEventData eventData, InterceptionResult result)
    {
        if (connection.State == ConnectionState.Open)
        {
            try
            {
                using var command = CreateCommand(connection, null);
                command.ExecuteNonQuery();
            }
            catch (DbException)
            {
                // A broken connection is discarded by the pool; nothing can leak from it.
            }
        }

        return result;
    }

    public override async ValueTask<InterceptionResult> ConnectionClosingAsync(
        DbConnection connection,
        ConnectionEventData eventData,
        InterceptionResult result)
    {
        if (connection.State == ConnectionState.Open)
        {
            try
            {
                await using var command = CreateCommand(connection, null);
                await command.ExecuteNonQueryAsync();
            }
            catch (DbException)
            {
                // A broken connection is discarded by the pool; nothing can leak from it.
            }
        }

        return result;
    }

    private static DbCommand CreateCommand(DbConnection connection, Guid? tenantId)
    {
        var command = connection.CreateCommand();
        command.CommandText = SetTenantSql;
        var parameter = command.CreateParameter();
        parameter.ParameterName = "tenant_id";
        parameter.DbType = DbType.String;
        // Empty string (not NULL) because set_config requires text; the RLS policies treat '' as "no tenant".
        parameter.Value = tenantId?.ToString() ?? string.Empty;
        command.Parameters.Add(parameter);
        return command;
    }
}
