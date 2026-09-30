using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Exceptions;
using TenantVault.Domain.Interfaces;

namespace TenantVault.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Last line of defense in the application layer: stamps new tenant-owned rows with the current
/// tenant and refuses to save any change that touches another tenant's row.
/// </summary>
public sealed class TenantSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly ITenantProvider _tenantProvider;

    public TenantSaveChangesInterceptor(ITenantProvider tenantProvider)
    {
        _tenantProvider = tenantProvider;
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        EnforceTenant(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        EnforceTenant(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void EnforceTenant(DbContext? context)
    {
        if (context is null) return;
        var current = _tenantProvider.TenantId;

        foreach (var entry in context.ChangeTracker.Entries<ITenantEntity>())
        {
            var entityName = entry.Metadata.ClrType.Name;
            switch (entry.State)
            {
                case EntityState.Added:
                    if (current is null)
                    {
                        throw new InvalidOperationException(
                            $"Cannot insert {entityName} without a tenant context. Tenant-owned writes fail closed.");
                    }

                    // Guid.Empty is the unset default; any other explicit value must already match.
                    if (entry.Entity.TenantId != Guid.Empty && entry.Entity.TenantId != current)
                    {
                        throw new TenantMismatchException(current, entry.Entity.TenantId, entityName);
                    }

                    entry.Entity.TenantId = current.Value;
                    break;

                case EntityState.Modified:
                case EntityState.Deleted:
                    var original = (Guid)entry.Property(nameof(ITenantEntity.TenantId)).OriginalValue!;
                    if (current is null || original != current || entry.Entity.TenantId != current)
                    {
                        throw new TenantMismatchException(current, original, entityName);
                    }

                    break;
            }
        }
    }
}
