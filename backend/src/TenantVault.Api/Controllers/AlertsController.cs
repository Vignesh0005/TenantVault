using Microsoft.AspNetCore.Mvc;
using TenantVault.Api.Filters;
using TenantVault.Application.DTOs.Insights;
using TenantVault.Application.Services;

namespace TenantVault.Api.Controllers;

[Route("alerts")]
[TenantRequired]
public sealed class AlertsController : TenantControllerBase
{
    private readonly InventoryInsightsService _insights;

    public AlertsController(InventoryInsightsService insights)
    {
        _insights = insights;
    }

    /// <summary>Optional <c>type</c>: low_stock, out_of_stock, dead_stock or anomaly.</summary>
    [HttpGet]
    public Task<IReadOnlyList<AlertDto>> List([FromQuery] string? type, CancellationToken ct) => _insights.GetAlertsAsync(type, ct);
}
