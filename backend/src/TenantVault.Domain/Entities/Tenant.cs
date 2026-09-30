namespace TenantVault.Domain.Entities;

public class Tenant
{
    /// <summary>Owner of audit entries that could not be attributed to a real tenant.</summary>
    public static readonly Guid SystemTenantId = Guid.Empty;

    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
}
