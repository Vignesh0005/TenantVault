using TenantVault.Domain.Attributes;

namespace TenantVault.Domain.Entities;

[TenantAgnostic("Memberships link users to tenants and must be readable before a tenant is selected (login, /me, /tenants). Access is always filtered by the authenticated user id.")]
public class Membership
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public Role Role { get; set; }
    public DateTime CreatedAt { get; set; }
}
