using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TenantVault.Application.DTOs.Auth;
using TenantVault.Application.Services;

namespace TenantVault.Api.Controllers;

[Route("auth")]
public sealed class AuthController : TenantControllerBase
{
    private readonly TokenService _tokens;

    public AuthController(TokenService tokens)
    {
        _tokens = tokens;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        var response = await _tokens.RegisterAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public Task<AuthResponse> Login(LoginRequest request, CancellationToken ct) => _tokens.LoginAsync(request, ct);

    /// <summary>Re-issues a token for the signed-in user with their current memberships.</summary>
    [HttpPost("refresh")]
    public Task<AuthResponse> Refresh(CancellationToken ct) => _tokens.RefreshAsync(RequireUserId(), ct);
}
