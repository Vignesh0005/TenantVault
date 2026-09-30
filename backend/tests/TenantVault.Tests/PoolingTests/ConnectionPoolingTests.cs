using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.Interfaces;
using TenantVault.Tests.Infrastructure;

namespace TenantVault.Tests.PoolingTests;

/// <summary>
/// The API's pool is capped at 2 connections, so alternating tenants reuse the same physical
/// connections. Any leaked <c>app.tenant_id</c> or cached filter value would show up here.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class ConnectionPoolingTests
{
    private readonly ApiFixture _fixture;

    public ConnectionPoolingTests(ApiFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task Alternating_tenants_on_pooled_connections_never_bleed()
    {
        var (client, auth) = await _fixture.LoginAsync("multi@demo.com");
        var tenantIds = auth.Tenants.ToDictionary(t => t.Slug, t => t.Id);

        for (var i = 0; i < 12; i++)
        {
            foreach (var slug in new[] { "acme-corp", "globex-ltd", "initech" })
            {
                var response = await client.SendAsync(ApiFixture.Request(HttpMethod.Get, "/products?pageSize=100", slug));
                response.EnsureSuccessStatusCode();
                var page = (await response.Content.ReadFromJsonAsync<PagedResult<ProductDto>>())!;

                Assert.NotEmpty(page.Items);
                Assert.All(page.Items, p => Assert.Equal(tenantIds[slug], p.TenantId));
            }
        }
    }

    [DockerFact]
    public async Task Scope_without_tenant_sees_nothing_after_a_tenant_scope_used_the_connection()
    {
        var (_, auth) = await _fixture.LoginAsync("acme@demo.com");
        var acmeId = auth.Tenants.Single().Id;

        using (var tenantScope = _fixture.Factory.Services.CreateScope())
        {
            tenantScope.ServiceProvider.GetRequiredService<ITenantProvider>().SetTenant(acmeId);
            var db = tenantScope.ServiceProvider.GetRequiredService<IAppDbContext>();
            Assert.True(await db.Products.CountAsync() >= 10);
        }

        using var unboundScope = _fixture.Factory.Services.CreateScope();
        var unbound = unboundScope.ServiceProvider.GetRequiredService<IAppDbContext>();
        Assert.Equal(0, await unbound.Products.CountAsync());
        Assert.Equal(0, await unbound.StockMovements.CountAsync());
    }

    [DockerFact]
    public void Tenant_context_is_locked_after_first_binding()
    {
        using var scope = _fixture.Factory.Services.CreateScope();
        var provider = scope.ServiceProvider.GetRequiredService<ITenantProvider>();
        provider.SetTenant(Guid.NewGuid());

        Assert.Throws<InvalidOperationException>(() => provider.SetTenant(Guid.NewGuid()));
    }
}
