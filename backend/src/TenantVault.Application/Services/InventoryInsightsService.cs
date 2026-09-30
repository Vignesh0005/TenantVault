using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TenantVault.Application.DTOs.Insights;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Services;

/// <summary>
/// Dashboard, alerts, analytics and the statistical "AI" signals. Every query goes through the
/// tenant-filtered DbSets, so results can only ever describe the current tenant.
/// </summary>
public sealed class InventoryInsightsService
{
    private const int UsageWindowDays = 30;
    private static readonly TimeSpan DashboardTtl = TimeSpan.FromSeconds(15);

    private readonly IAppDbContext _db;
    private readonly ITenantCache _cache;
    private readonly InventoryOptions _options;

    public InventoryInsightsService(IAppDbContext db, ITenantCache cache, IOptions<InventoryOptions> options)
    {
        _db = db;
        _cache = cache;
        _options = options.Value;
    }

    public Task<DashboardDto> GetDashboardAsync(CancellationToken ct) =>
        _cache.GetOrCreateAsync(ProductService.DashboardCacheKey, DashboardTtl, BuildDashboardAsync, ct);

    private async Task<DashboardDto> BuildDashboardAsync(CancellationToken ct)
    {
        var products = _db.Products.AsNoTracking();
        var threshold = _options.LowStockThreshold;

        var totalSkus = await products.CountAsync(ct);
        var inventoryValue = await products.SumAsync(p => (decimal?)p.Price * p.Quantity, ct) ?? 0m;
        var lowStock = await products.CountAsync(p => p.Quantity <= threshold, ct);
        var categories = await products.Where(p => p.Category != null).Select(p => p.Category).Distinct().CountAsync(ct);

        var recent = await _db.StockMovements.AsNoTracking()
            .OrderByDescending(m => m.Timestamp)
            .Take(10)
            .Select(m => new { Movement = m, m.Product.Name, m.Product.Sku, m.User.Email })
            .ToListAsync(ct);

        var alerts = await GetAlertsAsync(null, ct);

        return new DashboardDto(
            totalSkus,
            decimal.Round(inventoryValue, 2),
            lowStock,
            categories,
            recent.Select(r => ProductService.ToMovementDto(r.Movement, r.Name, r.Sku, r.Email)).ToList(),
            alerts.Take(6).ToList());
    }

    public async Task<IReadOnlyList<AlertDto>> GetAlertsAsync(string? type, CancellationToken ct)
    {
        var alerts = new List<AlertDto>();
        var threshold = _options.LowStockThreshold;

        if (type is null or "low_stock")
        {
            var low = await _db.Products.AsNoTracking()
                .Where(p => p.Quantity <= threshold)
                .OrderBy(p => p.Quantity)
                .ToListAsync(ct);
            alerts.AddRange(low.Select(p => new AlertDto(
                $"low_stock:{p.Id}",
                "low_stock",
                p.Quantity == 0 ? "critical" : "warning",
                p.Quantity == 0 ? $"{p.Name} is out of stock" : $"{p.Name} is low on stock ({p.Quantity} left)",
                p.Id, p.Name, p.Sku, p.UpdatedAt)));
        }

        if (type is null or "dead_stock")
        {
            var dead = await GetDeadStockAsync(ct);
            alerts.AddRange(dead.Select(d => new AlertDto(
                $"dead_stock:{d.ProductId}",
                "dead_stock",
                "info",
                $"{d.Name} has not moved in {d.DaysSinceLastMovement} days",
                d.ProductId, d.Name, d.Sku, DateTime.UtcNow.AddDays(-d.DaysSinceLastMovement))));
        }

        if (type is null or "anomaly")
        {
            var anomalies = await GetAnomaliesAsync(ct);
            alerts.AddRange(anomalies.Select(a => new AlertDto(
                $"anomaly:{a.Id}", "anomaly", "warning", a.Description, a.ProductId, a.Name, a.Sku, a.DetectedAt)));
        }

        return alerts
            .OrderBy(a => a.Severity switch { "critical" => 0, "warning" => 1, _ => 2 })
            .ThenByDescending(a => a.CreatedAt)
            .ToList();
    }

    public async Task<IReadOnlyList<TrendPointDto>> GetTrendsAsync(int days, CancellationToken ct)
    {
        days = Math.Clamp(days, 1, 365);
        var start = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-(days - 1)), DateTimeKind.Utc);

        var movements = await _db.StockMovements.AsNoTracking()
            .Where(m => m.Timestamp >= start)
            .Select(m => new { m.Timestamp, m.Delta, m.Product.Price })
            .ToListAsync(ct);

        var byDay = movements.GroupBy(m => m.Timestamp.Date).ToDictionary(g => g.Key);
        var points = new List<TrendPointDto>(days);
        for (var day = start.Date; day <= DateTime.UtcNow.Date; day = day.AddDays(1))
        {
            byDay.TryGetValue(day, out var group);
            var inbound = group?.Where(m => m.Delta > 0).Sum(m => m.Delta) ?? 0;
            var outbound = group?.Where(m => m.Delta < 0).Sum(m => -m.Delta) ?? 0;
            var value = group?.Sum(m => m.Delta * m.Price) ?? 0m;
            points.Add(new TrendPointDto(day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), inbound, outbound, decimal.Round(value, 2)));
        }

        return points;
    }

    public async Task<IReadOnlyList<DeadStockItemDto>> GetDeadStockAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var cutoff = now.AddDays(-_options.DeadStockDays);

        var rows = await _db.Products.AsNoTracking()
            .Where(p => p.Quantity > 0)
            .Select(p => new
            {
                Product = p,
                LastMovement = p.Movements.Max(m => (DateTime?)m.Timestamp),
            })
            .Where(r => (r.LastMovement ?? r.Product.CreatedAt) < cutoff)
            .ToListAsync(ct);

        return rows
            .Select(r => new DeadStockItemDto(
                r.Product.Id,
                r.Product.Sku,
                r.Product.Name,
                r.Product.Quantity,
                decimal.Round(r.Product.Price * r.Product.Quantity, 2),
                (int)(now - (r.LastMovement ?? r.Product.CreatedAt)).TotalDays))
            .OrderByDescending(d => d.Value)
            .ToList();
    }

    public async Task<IReadOnlyList<CategoryTurnoverDto>> GetTurnoverAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-UsageWindowDays);
        var products = await _db.Products.AsNoTracking()
            .Select(p => new
            {
                Category = p.Category ?? "Uncategorized",
                p.Price,
                p.Quantity,
                Sold = p.Movements.Where(m => m.Timestamp >= since && m.Delta < 0).Sum(m => (int?)-m.Delta) ?? 0,
            })
            .ToListAsync(ct);

        return products
            .GroupBy(p => p.Category)
            .Select(g =>
            {
                var onHand = g.Sum(p => p.Quantity);
                var sold = g.Sum(p => p.Sold);
                return new CategoryTurnoverDto(
                    g.Key,
                    g.Count(),
                    decimal.Round(g.Sum(p => p.Price * p.Quantity), 2),
                    sold,
                    Math.Round(sold / (double)Math.Max(1, onHand), 2));
            })
            .OrderByDescending(c => c.Value)
            .ToList();
    }

    public async Task<IReadOnlyList<StockoutPredictionDto>> GetStockoutPredictionsAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-UsageWindowDays);
        var rows = await _db.Products.AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.Sku,
                p.Name,
                p.Quantity,
                Used = p.Movements
                    .Where(m => m.Timestamp >= since && m.Delta < 0 && m.Reason != StockMovement.Reasons.Adjustment)
                    .Sum(m => (int?)-m.Delta) ?? 0,
            })
            .ToListAsync(ct);

        return rows
            .Select(r =>
            {
                var daily = r.Used / (double)UsageWindowDays;
                int? daysLeft = daily > 0 ? (int)Math.Floor(r.Quantity / daily) : null;
                // Reorder enough to cover the next usage window plus the low-stock buffer.
                var target = (int)Math.Ceiling(daily * UsageWindowDays) + _options.LowStockThreshold;
                return new StockoutPredictionDto(r.Id, r.Sku, r.Name, r.Quantity, Math.Round(daily, 2), daysLeft,
                    Math.Max(0, target - r.Quantity));
            })
            .Where(p => p.DaysUntilStockout is not null || p.CurrentQuantity <= _options.LowStockThreshold)
            .OrderBy(p => p.DaysUntilStockout ?? int.MaxValue)
            .ThenBy(p => p.CurrentQuantity)
            .Take(20)
            .ToList();
    }

    public async Task<IReadOnlyList<ReorderRecommendationDto>> GetReorderRecommendationsAsync(CancellationToken ct)
    {
        var predictions = await GetStockoutPredictionsAsync(ct);
        return predictions
            .Where(p => p.SuggestedReorderQty > 0 &&
                        (p.CurrentQuantity <= _options.LowStockThreshold || p.DaysUntilStockout <= 14))
            .Select(p => new ReorderRecommendationDto(
                p.ProductId,
                p.Sku,
                p.Name,
                p.CurrentQuantity,
                p.SuggestedReorderQty,
                p.DaysUntilStockout is { } days
                    ? $"Projected to run out in {days} day{(days == 1 ? "" : "s")} at {p.DailyUsage:0.##}/day"
                    : $"At or below the low-stock threshold of {_options.LowStockThreshold}"))
            .ToList();
    }

    /// <summary>Flags single movements far larger than the product's typical movement size.</summary>
    public async Task<IReadOnlyList<AnomalyDto>> GetAnomaliesAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-UsageWindowDays);
        var movements = await _db.StockMovements.AsNoTracking()
            .Where(m => m.Timestamp >= since)
            .Select(m => new { m.Id, m.ProductId, m.Delta, m.Reason, m.Timestamp, m.Product.Sku, m.Product.Name })
            .ToListAsync(ct);

        var anomalies = new List<AnomalyDto>();
        foreach (var group in movements.GroupBy(m => m.ProductId))
        {
            var items = group.ToList();
            if (items.Count < 3) continue;

            foreach (var m in items)
            {
                var others = items.Where(o => o.Id != m.Id).ToList();
                var typical = others.Average(o => Math.Abs(o.Delta));
                var size = Math.Abs(m.Delta);
                var limit = Math.Max(typical * 3, 10);
                if (size <= limit) continue;

                var direction = m.Delta < 0 ? "drop" : "increase";
                anomalies.Add(new AnomalyDto(
                    m.Id,
                    m.ProductId,
                    m.Sku,
                    m.Name,
                    $"Unusual {direction} of {size} units for {m.Name} ({m.Reason}); typical movement is ~{typical:0} units",
                    Math.Round(Math.Min(1, size / (typical * 6 + 1)), 2),
                    m.Timestamp));
            }
        }

        return anomalies.OrderByDescending(a => a.DetectedAt).Take(20).ToList();
    }
}
