using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TenantVault.Api.Filters;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;
using TenantVault.Domain.Entities;

namespace TenantVault.Api.Controllers;

[Route("export")]
[TenantRequired]
[RequireRole(Role.Admin, Role.Staff)]
public sealed class ExportController : TenantControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly ProductService _products;
    private readonly ITenantProvider _tenantProvider;

    public ExportController(ProductService products, ITenantProvider tenantProvider)
    {
        _products = products;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("products.csv")]
    [Produces("text/csv")]
    public async Task<IActionResult> ProductsCsv(CancellationToken ct)
    {
        var products = await _products.ExportAsync("csv", ct);
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(ProductService.ToCsv(products))).ToArray();
        return File(bytes, "text/csv; charset=utf-8", FileName("csv"));
    }

    [HttpGet("products.json")]
    public async Task<IActionResult> ProductsJson(CancellationToken ct)
    {
        var products = await _products.ExportAsync("json", ct);
        return File(JsonSerializer.SerializeToUtf8Bytes(products, JsonOptions), "application/json", FileName("json"));
    }

    private string FileName(string extension) =>
        $"{_tenantProvider.TenantSlug ?? "tenant"}-products-{DateTime.UtcNow:yyyyMMdd}.{extension}";
}
