using TenantVault.Application.DTOs.Products;

namespace TenantVault.Application.DTOs.Insights;

public sealed record AlertDto(
    string Id,
    string Type,
    string Severity,
    string Message,
    Guid? ProductId,
    string? ProductName,
    string? Sku,
    DateTime CreatedAt);

public sealed record DashboardDto(
    int TotalSkus,
    decimal InventoryValue,
    int LowStockCount,
    int CategoryCount,
    IReadOnlyList<StockMovementDto> RecentMovements,
    IReadOnlyList<AlertDto> Alerts);

public sealed record TrendPointDto(string Date, int Inbound, int Outbound, decimal Value);

public sealed record DeadStockItemDto(Guid ProductId, string Sku, string Name, int Quantity, decimal Value, int DaysSinceLastMovement);

public sealed record CategoryTurnoverDto(string Category, int Count, decimal Value, int UnitsSold, double TurnoverRatio);

public sealed record StockoutPredictionDto(
    Guid ProductId,
    string Sku,
    string Name,
    int CurrentQuantity,
    double DailyUsage,
    int? DaysUntilStockout,
    int SuggestedReorderQty);

public sealed record ReorderRecommendationDto(
    Guid ProductId,
    string Sku,
    string Name,
    int CurrentQuantity,
    int RecommendedQuantity,
    string Reason);

public sealed record AnomalyDto(
    Guid Id,
    Guid? ProductId,
    string? Sku,
    string? Name,
    string Description,
    double Score,
    DateTime DetectedAt);

public sealed record AssistantRequest(string Message);

public sealed record AssistantResponse(Guid Id, string Reply, string TenantName, DateTime CreatedAt);
