using Microsoft.AspNetCore.Mvc;
using TenantVault.Application.DTOs.Tenants;
using TenantVault.Application.Services;

namespace TenantVault.Api.Controllers;

[Route("tenants")]
public sealed class TenantsController : TenantControllerBase
{
    private readonly TenantService _tenants;

    public TenantsController(TenantService tenants)
    {
        _tenants = tenants;
    }

    /// <summary>Only the tenants the caller is a member of.</summary>
    [HttpGet]
    public Task<IReadOnlyList<TenantDto>> List(CancellationToken ct) => _tenants.GetUserTenantsAsync(RequireUserId(), ct);

    /// <summary>Creates a workspace with the caller as Admin. Call <c>POST /auth/refresh</c> afterwards to get a token that includes it.</summary>
    [HttpPost]
    [ProducesResponseType<TenantDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<TenantDto>> Create(CreateTenantRequest request, CancellationToken ct)
    {
        var tenant = await _tenants.CreateTenantAsync(RequireUserId(), request, ct);
        return StatusCode(StatusCodes.Status201Created, tenant);
    }
}
