using Microsoft.AspNetCore.Mvc;
using TenantVault.Api.Filters;
using TenantVault.Application.DTOs.Insights;
using TenantVault.Application.Services;

namespace TenantVault.Api.Controllers;

[Route("ai")]
[TenantRequired]
public sealed class AiController : TenantControllerBase
{
    private readonly AiAssistantService _assistant;

    public AiController(AiAssistantService assistant)
    {
        _assistant = assistant;
    }

    /// <summary>Answers questions using only the current tenant's data.</summary>
    [HttpPost("assistant")]
    public Task<AssistantResponse> Assistant(AssistantRequest request, CancellationToken ct) => _assistant.AskAsync(request, ct);

    [HttpGet("stockout-prediction")]
    public Task<IReadOnlyList<StockoutPredictionDto>> StockoutPrediction(CancellationToken ct) =>
        _assistant.GetStockoutPredictionsAsync(ct);

    [HttpGet("reorder-recommendation")]
    public Task<IReadOnlyList<ReorderRecommendationDto>> ReorderRecommendation(CancellationToken ct) =>
        _assistant.GetReorderRecommendationsAsync(ct);

    [HttpGet("anomalies")]
    public Task<IReadOnlyList<AnomalyDto>> Anomalies(CancellationToken ct) => _assistant.GetAnomaliesAsync(ct);
}
