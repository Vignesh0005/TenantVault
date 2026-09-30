using TenantVault.Domain.Interfaces;

namespace TenantVault.Domain.Entities;

public class Product : ITenantEntity
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public string? ImageKey { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<StockMovement> Movements { get; set; } = new List<StockMovement>();
}
