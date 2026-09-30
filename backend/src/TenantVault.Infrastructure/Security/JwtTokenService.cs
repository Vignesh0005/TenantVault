using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TenantVault.Application.Interfaces;

namespace TenantVault.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public const int MinimumSecretBytes = 32;

    public string Issuer { get; set; } = "tenantvault-api";
    public string Audience { get; set; } = "tenantvault-web";
    public int ExpiryMinutes { get; set; } = 30;

    /// <summary>Populated from the <c>JWT_SECRET</c> environment variable.</summary>
    public string Secret { get; set; } = string.Empty;
}

public sealed class JwtTokenService : ITokenService
{
    public const string TenantIdsClaim = "tenant_ids";

    private readonly JwtOptions _options;
    private readonly JsonWebTokenHandler _handler = new() { MapInboundClaims = false };
    private readonly TokenValidationParameters _validationParameters;
    private readonly SigningCredentials _signingCredentials;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
        _validationParameters = CreateValidationParameters(_options);
        _signingCredentials = new SigningCredentials(CreateKey(_options.Secret), SecurityAlgorithms.HmacSha256);
    }

    public AccessToken CreateAccessToken(Guid userId, string email, IReadOnlyCollection<Guid> tenantIds)
    {
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(_options.ExpiryMinutes);

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expires,
            SigningCredentials = _signingCredentials,
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = userId.ToString(),
                [JwtRegisteredClaimNames.Email] = email,
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString(),
                [TenantIdsClaim] = tenantIds.Select(id => id.ToString()).ToArray(),
            },
        });

        return new AccessToken(token, expires);
    }

    public async Task<TokenValidationOutcome> ValidateTokenAsync(string token)
    {
        var result = await _handler.ValidateTokenAsync(token, _validationParameters);
        return result.IsValid
            ? new TokenValidationOutcome(true, null)
            : new TokenValidationOutcome(false, DescribeFailure(result.Exception));
    }

    public static TokenValidationParameters CreateValidationParameters(JwtOptions options) => new()
    {
        ValidateIssuer = true,
        ValidIssuer = options.Issuer,
        ValidateAudience = true,
        ValidAudience = options.Audience,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = CreateKey(options.Secret),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = JwtRegisteredClaimNames.Email,
    };

    public static string DescribeFailure(Exception? exception) => exception switch
    {
        SecurityTokenSignatureKeyNotFoundException or SecurityTokenInvalidSignatureException => "Invalid signature",
        SecurityTokenExpiredException => "Token expired",
        SecurityTokenInvalidIssuerException => "Invalid issuer",
        SecurityTokenInvalidAudienceException => "Invalid audience",
        SecurityTokenInvalidAlgorithmException => "Algorithm not allowed",
        SecurityTokenMalformedException or ArgumentException => "Malformed token",
        null => "Invalid token",
        _ => "Invalid token",
    };

    private static SymmetricSecurityKey CreateKey(string secret)
    {
        var bytes = Encoding.UTF8.GetBytes(secret);
        if (bytes.Length < JwtOptions.MinimumSecretBytes)
        {
            throw new InvalidOperationException(
                $"JWT_SECRET must be at least {JwtOptions.MinimumSecretBytes} bytes (256 bits).");
        }

        return new SymmetricSecurityKey(bytes);
    }
}
