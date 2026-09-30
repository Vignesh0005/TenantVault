using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TenantVault.Infrastructure.Persistence.Migrations;

/// <summary>
/// Second, independent isolation layer: PostgreSQL row-level security on every tenant-owned table,
/// forced even for the table owner, plus the least-privilege role the API connects as.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260930120000_RowLevelSecurity")]
public partial class RowLevelSecurity : Migration
{
    public const string AppRole = "tenantvault_app";

    public static readonly string[] TenantTables = ["products", "stock_movements", "audit_entries"];

    private static readonly string[] AllTables = ["tenants", "users", "memberships", "products", "stock_movements", "audit_entries"];

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{AppRole}') THEN
                    CREATE ROLE {AppRole} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
                END IF;
            END
            $$;
            """);
        migrationBuilder.Sql($"ALTER ROLE {AppRole} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;");
        migrationBuilder.Sql($"GRANT USAGE ON SCHEMA public TO {AppRole};");
        migrationBuilder.Sql($"GRANT SELECT, INSERT, UPDATE, DELETE ON {string.Join(", ", AllTables)} TO {AppRole};");

        foreach (var table in TenantTables)
        {
            migrationBuilder.Sql($"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;");
            migrationBuilder.Sql($"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;");
            // NULLIF: an unset or reset tenant ('') compares as NULL, so no rows match (fail closed).
            migrationBuilder.Sql($"""
                CREATE POLICY tenant_isolation_{table} ON {table}
                    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
                    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
                """);
        }
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var table in TenantTables)
        {
            migrationBuilder.Sql($"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table};");
            migrationBuilder.Sql($"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;");
            migrationBuilder.Sql($"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;");
        }

        migrationBuilder.Sql($"REVOKE SELECT, INSERT, UPDATE, DELETE ON {string.Join(", ", AllTables)} FROM {AppRole};");
        migrationBuilder.Sql($"REVOKE USAGE ON SCHEMA public FROM {AppRole};");
    }
}
