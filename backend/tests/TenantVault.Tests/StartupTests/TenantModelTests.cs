using System.Reflection;
using Microsoft.EntityFrameworkCore;
using TenantVault.Application.Services;
using TenantVault.Domain.Attributes;
using TenantVault.Domain.Interfaces;
using TenantVault.Infrastructure.Persistence;

namespace TenantVault.Tests.StartupTests;

public sealed class TenantModelTests
{
    [Fact]
    public void Every_entity_with_a_tenant_id_is_isolated_or_explicitly_agnostic()
    {
        using var context = CreateContext();
        TenantModelValidator.AssertModel(context.Model);
    }

    [Fact]
    public void Every_tenant_entity_has_a_query_filter()
    {
        using var context = CreateContext();
        var unfiltered = context.Model.GetEntityTypes()
            .Where(t => typeof(ITenantEntity).IsAssignableFrom(t.ClrType))
            .Where(t => t.GetQueryFilter() is null)
            .Select(t => t.ClrType.Name)
            .ToList();

        Assert.Empty(unfiltered);
    }

    [Fact]
    public void Validator_rejects_an_entity_that_skips_ITenantEntity()
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            TenantModelValidator.AssertTenantEntities([typeof(RogueEntity), typeof(JustifiedEntity)]));

        Assert.Contains(nameof(RogueEntity), ex.Message);
        Assert.DoesNotContain(nameof(JustifiedEntity), ex.Message);
    }

    [Fact]
    public void Tenant_agnostic_entities_carry_a_justification()
    {
        var agnostic = typeof(ITenantEntity).Assembly.GetTypes()
            .Select(t => (Type: t, Attribute: t.GetCustomAttribute<TenantAgnosticAttribute>()))
            .Where(x => x.Attribute is not null)
            .ToList();

        Assert.All(agnostic, x => Assert.False(string.IsNullOrWhiteSpace(x.Attribute!.Justification), x.Type.Name));
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=model-only")
            .UseSnakeCaseNamingConvention()
            .Options;
        return new AppDbContext(options, new TenantProvider());
    }

    private sealed class RogueEntity
    {
        public Guid TenantId { get; set; }
    }

    [TenantAgnostic("Test double")]
    private sealed class JustifiedEntity
    {
        public Guid TenantId { get; set; }
    }
}
