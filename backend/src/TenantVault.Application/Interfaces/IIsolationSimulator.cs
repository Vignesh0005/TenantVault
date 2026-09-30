using TenantVault.Application.DTOs.Security;

namespace TenantVault.Application.Interfaces;

public interface IIsolationSimulator
{
    /// <summary>Runs the 8 isolation checks for the given user/tenant. Never mutates or returns tenant data.</summary>
    Task<IReadOnlyList<SimulationResultDto>> RunAsync(Guid tenantId, Guid userId, IReadOnlyCollection<Guid> memberTenantIds, CancellationToken ct);
}
