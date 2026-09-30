namespace TenantVault.Domain.Interfaces;

/// <summary>
/// Marks an entity as owned by exactly one tenant. Every implementation is automatically
/// covered by the EF Core global query filter, the SaveChanges interceptor and PostgreSQL RLS.
/// </summary>
public interface ITenantEntity
{
    Guid TenantId { get; set; }
}
