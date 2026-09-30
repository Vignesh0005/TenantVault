using TenantVault.Domain.Interfaces;

namespace TenantVault.Domain.Entities;

public class StockMovement : ITenantEntity
{
    public static class Reasons
    {
        public const string Sale = "sale";
        public const string Restock = "restock";
        public const string Adjustment = "adjustment";
        public const string Scan = "scan";

        public static readonly IReadOnlySet<string> All = new HashSet<string> { Sale, Restock, Adjustment, Scan };
    }

    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Delta { get; set; }
    public string Reason { get; set; } = Reasons.Adjustment;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime Timestamp { get; set; }
    public int ResultingQuantity { get; set; }
}
