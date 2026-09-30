using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Services;

public sealed record TenantResolution(
    bool Succeeded,
    int StatusCode,
    string? Code,
    string? Error,
    Tenant? Tenant,
    Role? Role)
{
    public static TenantResolution Success(Tenant tenant, Role role) => new(true, 200, null, null, tenant, role);

    public static TenantResolution Fail(int status, string code, string error, Tenant? target = null) =>
        new(false, status, code, error, target, null);
}

/// <summary>
/// Single source of truth for turning a tenant identifier into a verified tenant binding.
/// Used by <c>TenantMiddleware</c> and by the isolation simulator.
/// </summary>
public sealed partial class TenantResolver
{
    public const string MissingError = "Tenant context required";
    public const string NotFoundError = "Tenant not found";
    public const string ForbiddenError = "You are not a member of this tenant";

    private readonly IAppDbContext _db;

    public TenantResolver(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<TenantResolution> ResolveAsync(
        string? identifier,
        Guid userId,
        IReadOnlyCollection<Guid> claimTenantIds,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(identifier))
        {
            return TenantResolution.Fail(400, "TENANT_MISSING", MissingError);
        }

        var value = identifier.Trim().ToLowerInvariant();
        Tenant? tenant = null;

        if (Guid.TryParse(value, out var tenantId))
        {
            tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        }
        else if (SlugPattern().IsMatch(value))
        {
            tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == value, ct);
        }

        if (tenant is null)
        {
            return TenantResolution.Fail(404, "TENANT_NOT_FOUND", NotFoundError);
        }

        if (!claimTenantIds.Contains(tenant.Id))
        {
            return TenantResolution.Fail(403, "TENANT_FORBIDDEN", ForbiddenError, tenant);
        }

        // The JWT may be stale (membership revoked after issue), so the database has the final say.
        var membership = await _db.Memberships.AsNoTracking()
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenant.Id, ct);

        return membership is null
            ? TenantResolution.Fail(403, "TENANT_FORBIDDEN", ForbiddenError, tenant)
            : TenantResolution.Success(tenant, membership.Role);
    }

    [GeneratedRegex("^[a-z0-9-]{1,63}$")]
    private static partial Regex SlugPattern();
}
