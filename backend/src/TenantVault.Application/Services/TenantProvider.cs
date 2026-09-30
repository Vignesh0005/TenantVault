using TenantVault.Application.Exceptions;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Services;

public sealed class TenantProvider : ITenantProvider
{
    public Guid? TenantId { get; private set; }
    public string? TenantSlug { get; private set; }
    public Role? Role { get; private set; }
    public bool IsLocked { get; private set; }

    public void SetTenant(Guid tenantId, string? slug = null, Role? role = null)
    {
        if (IsLocked)
        {
            throw new InvalidOperationException(
                $"Tenant context is locked to {TenantId} for this scope and cannot be changed to {tenantId}.");
        }

        TenantId = tenantId;
        TenantSlug = slug;
        Role = role;
        IsLocked = true;
    }

    public Guid RequireTenantId() =>
        TenantId ?? throw new BadRequestException("Tenant context required", "TENANT_MISSING");
}
