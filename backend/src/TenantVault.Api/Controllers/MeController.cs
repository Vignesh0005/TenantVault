using Microsoft.AspNetCore.Mvc;
using TenantVault.Application.DTOs.Auth;
using TenantVault.Application.DTOs.Tenants;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;

namespace TenantVault.Api.Controllers;

[Route("me")]
public sealed class MeController : TenantControllerBase
{
    private readonly TenantService _tenants;
    private readonly ICurrentUser _currentUser;

    public MeController(TenantService tenants, ICurrentUser currentUser)
    {
        _tenants = tenants;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<MeResponse> Get(CancellationToken ct)
    {
        var userId = RequireUserId();
        var tenants = await _tenants.GetUserTenantsAsync(userId, ct);
        return new MeResponse(new UserDto(userId, _currentUser.Email ?? string.Empty), tenants);
    }
}
