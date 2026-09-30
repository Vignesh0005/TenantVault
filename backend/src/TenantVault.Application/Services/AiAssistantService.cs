using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TenantVault.Application.DTOs.Insights;
using TenantVault.Application.Interfaces;

namespace TenantVault.Application.Services;

/// <summary>
/// Tenant-scoped inventory assistant. It answers from the current tenant's data only: every
/// lookup goes through the filtered DbSets or <see cref="InventoryInsightsService"/>.
/// </summary>
public sealed class AiAssistantService
{
    private static readonly CultureInfo Money = CultureInfo.GetCultureInfo("en-US");

    private readonly IAppDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly InventoryInsightsService _insights;
    private readonly InventoryOptions _options;

    public AiAssistantService(IAppDbContext db, ITenantProvider tenantProvider, InventoryInsightsService insights, IOptions<InventoryOptions> options)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        _insights = insights;
        _options = options.Value;
    }

    public Task<IReadOnlyList<StockoutPredictionDto>> GetStockoutPredictionsAsync(CancellationToken ct) =>
        _insights.GetStockoutPredictionsAsync(ct);

    public Task<IReadOnlyList<ReorderRecommendationDto>> GetReorderRecommendationsAsync(CancellationToken ct) =>
        _insights.GetReorderRecommendationsAsync(ct);

    public Task<IReadOnlyList<AnomalyDto>> GetAnomaliesAsync(CancellationToken ct) =>
        _insights.GetAnomaliesAsync(ct);

    public async Task<AssistantResponse> AskAsync(AssistantRequest request, CancellationToken ct)
    {
        var tenantId = _tenantProvider.RequireTenantId();
        var tenantName = await _db.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => t.Name).FirstAsync(ct);
        var text = request.Message.Trim().ToLowerInvariant();

        var reply = true switch
        {
            _ when ContainsAny(text, "reorder", "restock", "purchase", "buy", "order more") => await ReorderAsync(ct),
            _ when ContainsAny(text, "dead", "not moving", "slow", "stale", "idle") => await DeadStockAsync(ct),
            _ when ContainsAny(text, "anomal", "unusual", "spike", "suspicious", "strange") => await AnomaliesAsync(ct),
            _ when ContainsAny(text, "low", "running out", "out of stock", "stockout", "stock out") => await LowStockAsync(ct),
            _ when ContainsAny(text, "value", "worth", "expensive", "valuable") => await ValueAsync(ct),
            _ when ContainsAny(text, "categor") => await CategoriesAsync(ct),
            _ when ContainsAny(text, "how many", "count", "total", "summary", "overview") => await SummaryAsync(ct),
            _ => Help(),
        };

        return new AssistantResponse(Guid.NewGuid(), reply, tenantName, DateTime.UtcNow);
    }

    private async Task<string> LowStockAsync(CancellationToken ct)
    {
        var threshold = _options.LowStockThreshold;
        var items = await _db.Products.AsNoTracking()
            .Where(p => p.Quantity <= threshold)
            .OrderBy(p => p.Quantity).ThenBy(p => p.Name)
            .Take(10)
            .Select(p => new { p.Name, p.Sku, p.Quantity })
            .ToListAsync(ct);

        if (items.Count == 0) return $"Good news: no SKUs are at or below the low-stock threshold of {threshold}.";

        var sb = new StringBuilder($"{items.Count} SKU{Plural(items.Count)} at or below the threshold of {threshold}:\n");
        foreach (var i in items)
        {
            sb.Append("• ").Append(i.Name).Append(" (").Append(i.Sku).Append(") — ")
              .Append(i.Quantity == 0 ? "out of stock" : $"{i.Quantity} left").Append('\n');
        }

        sb.Append("\nAsk for \"reorder suggestions\" to see how much to order.");
        return sb.ToString();
    }

    private async Task<string> DeadStockAsync(CancellationToken ct)
    {
        var items = await _insights.GetDeadStockAsync(ct);
        if (items.Count == 0) return $"No dead stock: every product with inventory has moved in the last {_options.DeadStockDays} days.";

        var sb = new StringBuilder($"{items.Count} product{Plural(items.Count)} with no movement in {_options.DeadStockDays}+ days, tying up {items.Sum(i => i.Value).ToString("C", Money)}:\n");
        foreach (var i in items.Take(10))
        {
            sb.Append("• ").Append(i.Name).Append(" (").Append(i.Sku).Append(") — ")
              .Append(i.Quantity).Append(" units, idle ").Append(i.DaysSinceLastMovement).Append(" days\n");
        }

        return sb.ToString();
    }

    private async Task<string> ReorderAsync(CancellationToken ct)
    {
        var items = await _insights.GetReorderRecommendationsAsync(ct);
        if (items.Count == 0) return "Nothing needs reordering right now: stock covers projected demand.";

        var sb = new StringBuilder("Suggested reorders:\n");
        foreach (var i in items.Take(10))
        {
            sb.Append("• ").Append(i.Name).Append(" (").Append(i.Sku).Append(") — order ")
              .Append(i.RecommendedQuantity).Append(" (").Append(i.Reason).Append(")\n");
        }

        return sb.ToString();
    }

    private async Task<string> AnomaliesAsync(CancellationToken ct)
    {
        var items = await _insights.GetAnomaliesAsync(ct);
        if (items.Count == 0) return "No unusual stock movements in the last 30 days.";

        var sb = new StringBuilder($"{items.Count} unusual movement{Plural(items.Count)} detected:\n");
        foreach (var a in items.Take(8))
        {
            sb.Append("• ").Append(a.Description).Append(" on ").Append(a.DetectedAt.ToString("MMM d", CultureInfo.InvariantCulture)).Append('\n');
        }

        return sb.ToString();
    }

    private async Task<string> ValueAsync(CancellationToken ct)
    {
        var total = await _db.Products.AsNoTracking().SumAsync(p => (decimal?)p.Price * p.Quantity, ct) ?? 0m;
        var top = await _db.Products.AsNoTracking()
            .OrderByDescending(p => p.Price * p.Quantity)
            .Take(5)
            .Select(p => new { p.Name, p.Sku, Value = p.Price * p.Quantity })
            .ToListAsync(ct);

        var sb = new StringBuilder($"Total inventory value is {total.ToString("C", Money)}. Highest-value SKUs:\n");
        foreach (var p in top)
        {
            sb.Append("• ").Append(p.Name).Append(" (").Append(p.Sku).Append(") — ").Append(p.Value.ToString("C", Money)).Append('\n');
        }

        return sb.ToString();
    }

    private async Task<string> CategoriesAsync(CancellationToken ct)
    {
        var categories = await _insights.GetTurnoverAsync(ct);
        if (categories.Count == 0) return "There are no products yet, so there are no categories to report.";

        var sb = new StringBuilder("Inventory by category:\n");
        foreach (var c in categories)
        {
            sb.Append("• ").Append(c.Category).Append(" — ").Append(c.Count).Append(" SKU").Append(Plural(c.Count))
              .Append(", ").Append(c.Value.ToString("C", Money)).Append(", ").Append(c.UnitsSold).Append(" sold in 30 days\n");
        }

        return sb.ToString();
    }

    private async Task<string> SummaryAsync(CancellationToken ct)
    {
        var dashboard = await _insights.GetDashboardAsync(ct);
        return $"You have {dashboard.TotalSkus} SKUs across {dashboard.CategoryCount} categories, " +
               $"worth {dashboard.InventoryValue.ToString("C", Money)}. {dashboard.LowStockCount} " +
               $"{(dashboard.LowStockCount == 1 ? "is" : "are")} low on stock.";
    }

    private static string Help() =>
        "I can answer questions about this tenant's inventory. Try:\n" +
        "• \"Which SKUs are low on stock?\"\n" +
        "• \"Dead stock this month\"\n" +
        "• \"Reorder suggestions\"\n" +
        "• \"Any unusual movements?\"\n" +
        "• \"What is my inventory worth?\"";

    private static bool ContainsAny(string text, params string[] terms) => terms.Any(text.Contains);

    private static string Plural(int count) => count == 1 ? string.Empty : "s";
}
