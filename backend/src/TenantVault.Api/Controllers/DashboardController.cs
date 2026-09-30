using Microsoft.AspNetCore.Mvc;
using TenantVault.Api.Filters;
using TenantVault.Application.DTOs.Insights;
using TenantVault.Application.Services;

namespace TenantVault.Api.Controllers;

[Route("dashboard")]
[TenantRequired]
public sealed class DashboardController : TenantControllerBase
{
    private readonly InventoryInsightsService _insights;

    public DashboardController(InventoryInsightsService insights)
    {
        _insights = insights;
    }

    [HttpGet]
    public Task<DashboardDto> Get(CancellationToken ct) => _insights.GetDashboardAsync(ct);
}
