namespace TenantVault.Application.DTOs.Products;

public sealed record ProductDto(
    Guid Id,
    Guid TenantId,
    string Sku,
    string Name,
    string? Category,
    decimal Price,
    int Quantity,
    string? ImageUrl,
    int LowStockThreshold,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateProductRequest(string Name, string Sku, string? Category, decimal Price, int Quantity);

public sealed record UpdateProductRequest(string Name, string Sku, string? Category, decimal Price, int Quantity);

public sealed record ScanRequest(int Delta, string? Reason);

public sealed record ProductQuery(string? Search, string? Category, int Page = 1, int PageSize = 10);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record ImageUrlDto(string Url, DateTime ExpiresAt);

/// <summary>
/// Movement as consumed by the UI. <c>Type</c>/<c>Quantity</c>/<c>Note</c>/<c>CreatedAt</c> are UI-friendly
/// projections of the stored <c>Delta</c>/<c>Reason</c>/<c>Timestamp</c>, which are also included.
/// </summary>
public sealed record StockMovementDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string Sku,
    string Type,
    int Quantity,
    string? Note,
    string? ActorEmail,
    DateTime CreatedAt,
    int Delta,
    string Reason,
    int ResultingQuantity)
{
    public static string TypeFor(int delta, string reason) =>
        reason == "adjustment" ? "adjustment" : delta >= 0 ? "in" : "out";
}
