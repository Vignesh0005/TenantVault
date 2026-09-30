using Microsoft.EntityFrameworkCore;
using TenantVault.Application.DTOs.Auth;
using TenantVault.Application.DTOs.Tenants;
using TenantVault.Application.Exceptions;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Services;

/// <summary>
/// Authentication flows (register, login, refresh). Builds the membership-derived claims and
/// delegates signing to <see cref="ITokenService"/>.
/// </summary>
public sealed class TokenService
{
    private const string InvalidCredentials = "Invalid email or password";

    // Verified against when the email is unknown so response time doesn't reveal which emails exist.
    private static string? _timingEqualizerHash;

    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ITokenService _tokens;
    private readonly IAuditService _audit;
    private readonly ICurrentUser _currentUser;

    public TokenService(IAppDbContext db, IPasswordHasher hasher, ITokenService tokens, IAuditService audit, ICurrentUser currentUser)
    {
        _db = db;
        _hasher = hasher;
        _tokens = tokens;
        _audit = audit;
        _currentUser = currentUser;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var email = NormalizeEmail(request.Email);
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw new ConflictException("An account with this email already exists.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = _hasher.Hash(request.Password),
            CreatedAt = DateTime.UtcNow,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return await IssueAsync(user, ct);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = NormalizeEmail(request.Email);
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null)
        {
            _timingEqualizerHash ??= _hasher.Hash(Guid.NewGuid().ToString("N"));
            _hasher.Verify(request.Password, _timingEqualizerHash);
            await _audit.LogAsync(null, null, AuditEntry.Actions.LoginFailed, null,
                new { email, reason = "Unknown email", userAgent = _currentUser.UserAgent }, ct);
            throw new UnauthorizedException(InvalidCredentials, "INVALID_CREDENTIALS");
        }

        var tenantIds = await _db.Memberships.AsNoTracking()
            .Where(m => m.UserId == user.Id)
            .Select(m => m.TenantId)
            .ToListAsync(ct);

        if (!_hasher.Verify(request.Password, user.PasswordHash))
        {
            await LogToEachTenantAsync(tenantIds, user.Id, AuditEntry.Actions.LoginFailed,
                new { email, reason = "Wrong password", userAgent = _currentUser.UserAgent }, ct);
            throw new UnauthorizedException(InvalidCredentials, "INVALID_CREDENTIALS");
        }

        await LogToEachTenantAsync(tenantIds, user.Id, AuditEntry.Actions.Login,
            new { email, userAgent = _currentUser.UserAgent }, ct);
        return await IssueAsync(user, ct);
    }

    public async Task<AuthResponse> RefreshAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw new UnauthorizedException("Account no longer exists");
        return await IssueAsync(user, ct);
    }

    private async Task<AuthResponse> IssueAsync(User user, CancellationToken ct)
    {
        var memberships = await _db.Memberships.AsNoTracking()
            .Where(m => m.UserId == user.Id)
            .Include(m => m.Tenant)
            .OrderBy(m => m.Tenant.Name)
            .ToListAsync(ct);

        var token = _tokens.CreateAccessToken(user.Id, user.Email, memberships.Select(m => m.TenantId).ToList());
        return new AuthResponse(
            token.Token,
            token.ExpiresAt,
            new UserDto(user.Id, user.Email),
            memberships.Select(m => TenantDto.From(m.Tenant, m.Role)).ToList());
    }

    // Login events are recorded in every tenant the user belongs to, so each tenant's admins see them.
    private async Task LogToEachTenantAsync(IReadOnlyCollection<Guid> tenantIds, Guid userId, string action, object metadata, CancellationToken ct)
    {
        if (tenantIds.Count == 0)
        {
            await _audit.LogAsync(null, userId, action, null, metadata, ct);
            return;
        }

        foreach (var tenantId in tenantIds)
        {
            await _audit.LogAsync(tenantId, userId, action, null, metadata, ct);
        }
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
