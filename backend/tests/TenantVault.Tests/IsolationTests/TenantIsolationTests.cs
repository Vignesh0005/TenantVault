using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.DTOs.Security;
using TenantVault.Tests.Infrastructure;

namespace TenantVault.Tests.IsolationTests;

[Collection(ApiCollection.Name)]
public sealed class TenantIsolationTests
{
    private readonly ApiFixture _fixture;

    public TenantIsolationTests(ApiFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task Product_created_by_acme_is_404_for_globex()
    {
        var (acme, _) = await _fixture.LoginAsync("acme@demo.com", "acme-corp");
        var create = await acme.PostAsJsonAsync("/products",
            new CreateProductRequest("Isolation Probe", $"ISO-{Guid.NewGuid():N}"[..12].ToUpperInvariant(), "Test", 1m, 1));
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var product = (await create.Content.ReadFromJsonAsync<ProductDto>())!;

        var (globex, _) = await _fixture.LoginAsync("globex@demo.com", "globex-ltd");

        Assert.Equal(HttpStatusCode.NotFound, (await globex.GetAsync($"/products/{product.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await globex.PutAsJsonAsync($"/products/{product.Id}",
            new UpdateProductRequest("Hijacked", "HIJACKED", null, 0m, 0))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await globex.DeleteAsync($"/products/{product.Id}")).StatusCode);

        // Still intact for its owner.
        var owned = await acme.GetFromJsonAsync<ProductDto>($"/products/{product.Id}");
        Assert.Equal("Isolation Probe", owned!.Name);
    }

    [DockerFact]
    public async Task Spoofed_tenant_header_is_403_with_explanation()
    {
        var (client, _) = await _fixture.LoginAsync("acme@demo.com", "globex-ltd");

        var response = await client.GetAsync("/products");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("TENANT_FORBIDDEN", body.GetProperty("code").GetString());
        Assert.Equal("You are not a member of this tenant", body.GetProperty("error").GetString());
    }

    [DockerFact]
    public async Task Missing_tenant_is_400_and_unknown_tenant_is_404()
    {
        var (client, _) = await _fixture.LoginAsync("acme@demo.com");

        var missing = await client.GetAsync("/products");
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal("TENANT_MISSING", (await missing.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());

        var unknown = await client.SendAsync(ApiFixture.Request(HttpMethod.Get, "/dashboard", "no-such-tenant"));
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [DockerFact]
    public async Task Unauthenticated_request_is_401_even_with_tenant_header()
    {
        var client = _fixture.Factory.CreateClient();
        var response = await client.SendAsync(ApiFixture.Request(HttpMethod.Get, "/products", "acme-corp"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [DockerFact]
    public async Task Same_sku_resolves_to_each_tenants_own_product()
    {
        var names = new List<string>();
        foreach (var (email, tenant) in new[] { ("acme@demo.com", "acme-corp"), ("globex@demo.com", "globex-ltd"), ("initech@demo.com", "initech") })
        {
            var (client, auth) = await _fixture.LoginAsync(email, tenant);
            var page = await client.GetFromJsonAsync<PagedResult<ProductDto>>("/products?search=SKU-001&pageSize=50");
            var product = Assert.Single(page!.Items, p => p.Sku == "SKU-001");
            Assert.Equal(auth.Tenants.Single().Id, product.TenantId);
            names.Add(product.Name);
        }

        Assert.Equal(3, names.Distinct().Count());
    }

    [DockerFact]
    public async Task Isolation_simulator_reports_all_eight_attacks_blocked()
    {
        var (client, _) = await _fixture.LoginAsync("multi@demo.com", "acme-corp");

        var response = await client.PostAsync("/security/simulate-attack", null);
        response.EnsureSuccessStatusCode();
        var results = (await response.Content.ReadFromJsonAsync<List<SimulationResultDto>>())!;

        Assert.Equal(8, results.Count);
        Assert.All(results, r => Assert.True(r.Blocked, $"{r.Attack}: expected {r.Expected}, got {r.Actual} ({r.Reason})"));
    }

    [DockerFact]
    public async Task Viewer_cannot_write()
    {
        var (client, _) = await _fixture.LoginAsync("multi@demo.com", "initech");

        var response = await client.PostAsJsonAsync("/products", new CreateProductRequest("Nope", "VIEWER-1", null, 1m, 1));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("ROLE_FORBIDDEN", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }
}
