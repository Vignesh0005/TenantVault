using TenantVault.Application.DTOs.Audit;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.DTOs.Security;

namespace TenantVault.Application.Interfaces;

public interface IAuditService
{
    /// <summary>
    /// Writes an audit entry in its own tenant scope. A null <paramref name="tenantId"/> is stored under the system tenant.
    /// Never throws: audit failures are logged so they cannot break the calling request.
    /// </summary>
    Task LogAsync(Guid? tenantId, Guid? userId, string action, string? resource, object? metadata, CancellationToken ct = default);

    Task<PagedResult<AuditEntryDto>> QueryAsync(AuditQuery query, CancellationToken ct);

    Task<SecurityDashboardDto> GetSecurityDashboardAsync(CancellationToken ct);
}
