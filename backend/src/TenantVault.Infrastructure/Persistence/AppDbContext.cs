using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;
using TenantVault.Domain.Interfaces;

namespace TenantVault.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly ITenantProvider _tenantProvider;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    /// <summary>
    /// Read by the global query filters on every query. EF parameterizes it per context instance,
    /// so it is never baked into the cached model. Null means "no tenant" and matches no rows.
    /// </summary>
    public Guid? CurrentTenantId => _tenantProvider.TenantId;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        TenantModelValidator.AssertTenantEntities(modelBuilder.Model.GetEntityTypes().Select(t => t.ClrType));
        ApplyTenantQueryFilters(modelBuilder);
    }

    private void ApplyTenantQueryFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                     .Where(t => typeof(ITenantEntity).IsAssignableFrom(t.ClrType)))
        {
            var param = Expression.Parameter(entityType.ClrType, "e");
            var tenantIdProp = Expression.Convert(
                Expression.Property(param, nameof(ITenantEntity.TenantId)),
                typeof(Guid?));
            var currentTenant = Expression.Property(
                Expression.Constant(this),
                nameof(CurrentTenantId));
            var body = Expression.Equal(tenantIdProp, currentTenant);

            modelBuilder.Entity(entityType.ClrType)
                .HasQueryFilter(Expression.Lambda(body, param));
        }
    }
}
