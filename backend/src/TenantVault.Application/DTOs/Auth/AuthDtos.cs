using TenantVault.Application.DTOs.Tenants;

namespace TenantVault.Application.DTOs.Auth;

public sealed record LoginRequest(string Email, string Password);

public sealed record RegisterRequest(string Email, string Password);

public sealed record UserDto(Guid Id, string Email);

public sealed record AuthResponse(string Token, DateTime ExpiresAt, UserDto User, IReadOnlyList<TenantDto> Tenants);
