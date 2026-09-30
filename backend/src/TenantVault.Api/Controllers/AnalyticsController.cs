using Microsoft.AspNetCore.Mvc;
using TenantVault.Api.Filters;
using TenantVault.Application.DTOs.Insights;
using TenantVault.Application.Services;

namespace TenantVault.Api.Controllers;

[Route("analytics")]
[TenantRequired]
public sealed class AnalyticsController : TenantControllerBase
{
    private readonly InventoryInsightsService _insights;

    public AnalyticsController(InventoryInsightsService insights)
    {
        _insights = insights;
    }

    [HttpGet("trends")]
    public Task<IReadOnlyList<TrendPointDto>> Trends([FromQuery] int days = 30, CancellationToken ct = default) =>
        _insights.GetTrendsAsync(Math.Clamp(days, 1, 365), ct);

    [HttpGet("dead-stock")]
    public Task<IReadOnlyList<DeadStockItemDto>> DeadStock(CancellationToken ct) => _insights.GetDeadStockAsync(ct);

    [HttpGet("turnover")]
    public Task<IReadOnlyList<CategoryTurnoverDto>> Turnover(CancellationToken ct) => _insights.GetTurnoverAsync(ct);
}
