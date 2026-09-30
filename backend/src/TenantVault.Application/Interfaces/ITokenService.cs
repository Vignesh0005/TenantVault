namespace TenantVault.Application.Interfaces;

public sealed record AccessToken(string Token, DateTime ExpiresAt);

public sealed record TokenValidationOutcome(bool IsValid, string? FailureReason);

public interface ITokenService
{
    AccessToken CreateAccessToken(Guid userId, string email, IReadOnlyCollection<Guid> tenantIds);

    Task<TokenValidationOutcome> ValidateTokenAsync(string token);
}
