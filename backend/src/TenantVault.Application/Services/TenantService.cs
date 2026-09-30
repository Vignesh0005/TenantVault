using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TenantVault.Application.DTOs.Tenants;
using TenantVault.Application.Exceptions;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Security;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Services;

public sealed partial class TenantService
{
    private readonly IAppDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly ICurrentUser _currentUser;
    private readonly IAuditService _audit;

    public TenantService(IAppDbContext db, ITenantProvider tenantProvider, ICurrentUser currentUser, IAuditService audit)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        _currentUser = currentUser;
        _audit = audit;
    }

    public async Task<IReadOnlyList<TenantDto>> GetUserTenantsAsync(Guid userId, CancellationToken ct)
    {
        var memberships = await _db.Memberships.AsNoTracking()
            .Where(m => m.UserId == userId)
            .Include(m => m.Tenant)
            .OrderBy(m => m.Tenant.Name)
            .ToListAsync(ct);

        return memberships.Select(m => TenantDto.From(m.Tenant, m.Role)).ToList();
    }

    public async Task<TenantDto> CreateTenantAsync(Guid userId, CreateTenantRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        var baseSlug = Slugify(name);
        var slug = baseSlug;
        var suffix = 2;
        while (await _db.Tenants.AnyAsync(t => t.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{suffix++}";
        }

        var now = DateTime.UtcNow;
        var tenant = new Tenant { Id = Guid.NewGuid(), Name = name, Slug = slug, CreatedAt = now };
        _db.Tenants.Add(tenant);
        _db.Memberships.Add(new Membership { UserId = userId, TenantId = tenant.Id, Role = Role.Admin, CreatedAt = now });
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(tenant.Id, userId, AuditEntry.Actions.TenantCreate, $"tenant:{tenant.Id}", new { tenant.Name, tenant.Slug }, ct);
        return TenantDto.From(tenant, Role.Admin);
    }

    public async Task<SecurityContextDto> GetSecurityContextAsync(bool isSwitch, CancellationToken ct)
    {
        var tenantId = _tenantProvider.RequireTenantId();
        var role = _tenantProvider.Role ?? throw new ForbiddenException(TenantResolver.ForbiddenError, "TENANT_FORBIDDEN");
        var tenant = await _db.Tenants.AsNoTracking().FirstAsync(t => t.Id == tenantId, ct);

        if (isSwitch)
        {
            await _audit.LogAsync(tenantId, _currentUser.UserId, AuditEntry.Actions.TenantSwitch, $"tenant:{tenantId}",
                new { tenant = tenant.Slug }, ct);
        }

        return new SecurityContextDto(TenantDto.From(tenant, role), role.ToString().ToLowerInvariant(), RolePermissions.For(role));
    }

    public static string Slugify(string name)
    {
        var slug = NonSlugChars().Replace(name.ToLowerInvariant(), "-").Trim('-');
        slug = RepeatedDashes().Replace(slug, "-");
        if (slug.Length > 50) slug = slug[..50].TrimEnd('-');
        return string.IsNullOrEmpty(slug) ? "tenant" : slug;
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlugChars();

    [GeneratedRegex("-{2,}")]
    private static partial Regex RepeatedDashes();
}
