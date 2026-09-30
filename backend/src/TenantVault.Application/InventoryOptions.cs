namespace TenantVault.Application;

public sealed class InventoryOptions
{
    public const string SectionName = "Inventory";

    /// <summary>Products at or below this quantity are considered low stock.</summary>
    public int LowStockThreshold { get; set; } = 10;

    /// <summary>Products without movement for this many days are considered dead stock.</summary>
    public int DeadStockDays { get; set; } = 30;
}
