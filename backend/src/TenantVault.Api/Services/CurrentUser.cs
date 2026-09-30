using System.Diagnostics;
using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using TenantVault.Application.Exceptions;
using TenantVault.Application.Interfaces;
using TenantVault.Infrastructure.Security;

namespace TenantVault.Api.Services;

public sealed class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUser(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    private HttpContext? Context => _accessor.HttpContext;
    private ClaimsPrincipal? Principal => Context?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid? UserId =>
        IsAuthenticated && Guid.TryParse(Principal!.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;

    public string? Email => IsAuthenticated ? Principal!.FindFirstValue(JwtRegisteredClaimNames.Email) : null;

    public IReadOnlyCollection<Guid> TenantIds =>
        IsAuthenticated
            ? Principal!.FindAll(JwtTokenService.TenantIdsClaim)
                .Select(c => Guid.TryParse(c.Value, out var id) ? id : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList()
            : [];

    public string IpAddress => Context?.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public string? UserAgent
    {
        get
        {
            var value = Context?.Request.Headers.UserAgent.ToString();
            return string.IsNullOrEmpty(value) ? null : value[..Math.Min(value.Length, 512)];
        }
    }

    public string TraceId => Activity.Current?.Id ?? Context?.TraceIdentifier ?? string.Empty;

    public string? RequestMethod => Context?.Request.Method;

    public string? RequestPath => Context?.Request.Path.Value;

    public Guid RequireUserId() =>
        UserId ?? throw new UnauthorizedException("Authentication required", "UNAUTHENTICATED");
}
