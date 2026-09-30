namespace TenantVault.Application.Interfaces;

public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid? UserId { get; }
    string? Email { get; }

    /// <summary>Tenant ids from the JWT <c>tenant_ids</c> claim.</summary>
    IReadOnlyCollection<Guid> TenantIds { get; }

    string IpAddress { get; }
    string? UserAgent { get; }
    string TraceId { get; }
    string? RequestMethod { get; }
    string? RequestPath { get; }

    Guid RequireUserId();
}
