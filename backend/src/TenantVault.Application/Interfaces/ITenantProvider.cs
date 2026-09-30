using TenantVault.Domain.Entities;

namespace TenantVault.Application.Interfaces;

/// <summary>
/// Request-scoped holder of the resolved tenant. It can be set exactly once; any later
/// attempt to change it throws (Tenant Context Lock).
/// </summary>
public interface ITenantProvider
{
    Guid? TenantId { get; }
    string? TenantSlug { get; }
    Role? Role { get; }
    bool IsLocked { get; }

    /// <summary>Binds the tenant for the rest of the scope and locks the provider.</summary>
    void SetTenant(Guid tenantId, string? slug = null, Role? role = null);

    /// <summary>Returns the tenant id or throws if no tenant is bound (fail closed).</summary>
    Guid RequireTenantId();
}
