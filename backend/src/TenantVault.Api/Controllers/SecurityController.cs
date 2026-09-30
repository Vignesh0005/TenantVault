using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TenantVault.Api.Filters;
using TenantVault.Api.Middleware;
using TenantVault.Application.DTOs.Security;
using TenantVault.Application.DTOs.Tenants;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;
using TenantVault.Domain.Entities;

namespace TenantVault.Api.Controllers;

[Route("security")]
public sealed class SecurityController : TenantControllerBase
{
    private readonly IAuditService _audit;
    private readonly TenantService _tenants;

    public SecurityController(IAuditService audit, TenantService tenants)
    {
        _audit = audit;
        _tenants = tenants;
    }

    [HttpGet("dashboard")]
    [TenantRequired]
    [RequireRole(Role.Admin, Role.Staff)]
    public Task<SecurityDashboardDto> Dashboard(CancellationToken ct) => _audit.GetSecurityDashboardAsync(ct);

    /// <summary>The caller's role and permissions in the current tenant. <c>?reason=switch</c> records a tenant switch.</summary>
    [HttpGet("context")]
    [TenantRequired]
    public Task<SecurityContextDto> Context([FromQuery] string? reason, CancellationToken ct) =>
        _tenants.GetSecurityContextAsync(string.Equals(reason, "switch", StringComparison.OrdinalIgnoreCase), ct);

    /// <summary>
    /// Runs the 8 isolation checks. Skipped by <see cref="TenantMiddleware"/> so that the request's own
    /// scope stays unbound; the tenant is verified here with the same resolver and each check gets its own scope.
    /// </summary>
    [HttpPost("simulate-attack")]
    [EnableRateLimiting(RateLimitPolicies.Simulator)]
    public async Task<ActionResult<IReadOnlyList<SimulationResultDto>>> SimulateAttack(
        [FromServices] TenantResolver resolver,
        [FromServices] IIsolationSimulator simulator,
        [FromServices] ICurrentUser currentUser,
        [FromServices] IOptions<TenancyOptions> tenancy,
        CancellationToken ct)
    {
        var userId = RequireUserId();
        var identifier = TenantIdentifier.Resolve(HttpContext, tenancy.Value);
        var resolution = await resolver.ResolveAsync(identifier, userId, currentUser.TenantIds, ct);
        if (!resolution.Succeeded)
        {
            return StatusCode(resolution.StatusCode, new { error = resolution.Error, code = resolution.Code });
        }

        var results = await simulator.RunAsync(resolution.Tenant!.Id, userId, currentUser.TenantIds, ct);
        return Ok(results);
    }
}
