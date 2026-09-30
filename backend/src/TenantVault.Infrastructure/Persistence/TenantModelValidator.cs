using System.Reflection;
using Microsoft.EntityFrameworkCore.Metadata;
using TenantVault.Domain.Attributes;
using TenantVault.Domain.Interfaces;

namespace TenantVault.Infrastructure.Persistence;

/// <summary>
/// Startup assertion: every entity exposing a <c>TenantId</c> must implement <see cref="ITenantEntity"/>
/// (and therefore be filtered), unless it is explicitly marked <see cref="TenantAgnosticAttribute"/>.
/// </summary>
public static class TenantModelValidator
{
    public static void AssertModel(IModel model) =>
        AssertTenantEntities(model.GetEntityTypes().Select(t => t.ClrType));

    public static void AssertTenantEntities(IEnumerable<Type> entityTypes)
    {
        var violations = entityTypes
            .Where(t => t.GetProperty(nameof(ITenantEntity.TenantId), BindingFlags.Public | BindingFlags.Instance) is not null)
            .Where(t => !typeof(ITenantEntity).IsAssignableFrom(t))
            .Where(t => t.GetCustomAttribute<TenantAgnosticAttribute>() is null)
            .Select(t => t.FullName ?? t.Name)
            .ToList();

        if (violations.Count > 0)
        {
            throw new InvalidOperationException(
                "Refusing to start: these entities have a TenantId but do not implement ITenantEntity, " +
                $"so they would not be tenant-filtered: {string.Join(", ", violations)}. " +
                "Implement ITenantEntity or mark the entity [TenantAgnostic] with a justification.");
        }
    }
}
