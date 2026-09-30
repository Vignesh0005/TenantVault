using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using TenantVault.Application.DTOs.Security;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;
using TenantVault.Domain.Entities;
using TenantVault.Domain.Exceptions;
using TenantVault.Infrastructure.Persistence;

namespace TenantVault.Infrastructure.Security;

/// <summary>
/// Runs the 8 isolation checks behind <c>POST /security/simulate-attack</c>. Each check runs in its
/// own DI scope (fresh DbContext + tenant binding). Nothing is ever committed or returned to the caller
/// except pass/fail evidence.
/// </summary>
public sealed class IsolationSimulator : IIsolationSimulator
{
    private const string CacheProbeKey = "isolation-probe";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ITokenService _tokenService;
    private readonly IFileStorage _storage;
    private readonly IMemoryCache _memoryCache;
    private readonly IConfiguration _configuration;
    private readonly JwtOptions _jwtOptions;
    private readonly ILogger<IsolationSimulator> _logger;

    public IsolationSimulator(
        IServiceScopeFactory scopeFactory,
        ITokenService tokenService,
        IFileStorage storage,
        IMemoryCache memoryCache,
        IConfiguration configuration,
        IOptions<JwtOptions> jwtOptions,
        ILogger<IsolationSimulator> logger)
    {
        _scopeFactory = scopeFactory;
        _tokenService = tokenService;
        _storage = storage;
        _memoryCache = memoryCache;
        _configuration = configuration;
        _jwtOptions = jwtOptions.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SimulationResultDto>> RunAsync(
        Guid tenantId,
        Guid userId,
        IReadOnlyCollection<Guid> memberTenantIds,
        CancellationToken ct)
    {
        var otherTenant = await FindOtherTenantAsync(tenantId, memberTenantIds, ct);
        var foreignProductId = otherTenant is null ? Guid.NewGuid() : await FindForeignProductIdAsync(otherTenant.Id, ct);

        var checks = new (string Attack, string Expected, Func<Task<SimulationResultDto>> Run)[]
        {
            ("missing_tenant_header", "400", () => MissingTenantHeaderAsync(userId, memberTenantIds, ct)),
            ("header_spoof", "403", () => HeaderSpoofAsync(tenantId, userId, memberTenantIds, ct)),
            ("forged_jwt", "401", () => ForgedJwtAsync(userId, memberTenantIds)),
            ("cross_tenant_read", "404", () => CrossTenantReadAsync(tenantId, foreignProductId, ct)),
            ("cross_tenant_write", "404", () => CrossTenantWriteAsync(tenantId, otherTenant?.Id, foreignProductId, ct)),
            ("path_traversal", "key rewritten", () => PathTraversalAsync(tenantId, otherTenant?.Id ?? Guid.NewGuid(), ct)),
            ("cache_probe", "cache miss", () => Task.FromResult(CacheProbe(tenantId, otherTenant?.Id ?? Guid.NewGuid()))),
            ("rls_bypass_raw_sql", "0 rows", () => RlsBypassAsync(ct)),
        };

        var results = new List<SimulationResultDto>(checks.Length);
        foreach (var check in checks)
        {
            try
            {
                results.Add(await check.Run());
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Isolation check {Attack} failed to execute", check.Attack);
                results.Add(new SimulationResultDto(check.Attack, check.Expected, "error", false,
                    $"Check could not run: {ex.GetType().Name}"));
            }
        }

        return results;
    }

    private async Task<SimulationResultDto> MissingTenantHeaderAsync(Guid userId, IReadOnlyCollection<Guid> memberIds, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var resolver = scope.ServiceProvider.GetRequiredService<TenantResolver>();
        var result = await resolver.ResolveAsync(null, userId, memberIds, ct);

        return Report("missing_tenant_header", "400", result.StatusCode.ToString(), result.StatusCode == 400,
            result.Error ?? "Request was accepted without a tenant");
    }

    private async Task<SimulationResultDto> HeaderSpoofAsync(Guid tenantId, Guid userId, IReadOnlyCollection<Guid> memberIds, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var resolver = scope.ServiceProvider.GetRequiredService<TenantResolver>();

        var foreign = await db.Tenants.AsNoTracking()
            .Where(t => !memberIds.Contains(t.Id))
            .OrderBy(t => t.Slug)
            .FirstOrDefaultAsync(ct);

        IReadOnlyCollection<Guid> claims = memberIds;
        var note = string.Empty;
        if (foreign is null)
        {
            // The user belongs to every tenant; spoof a tenant they are "not" in by dropping it from the claims.
            foreign = await db.Tenants.AsNoTracking().Where(t => t.Id != tenantId).OrderBy(t => t.Slug).FirstOrDefaultAsync(ct)
                      ?? await db.Tenants.AsNoTracking().FirstAsync(t => t.Id == tenantId, ct);
            claims = memberIds.Where(id => id != foreign.Id).ToList();
            note = " (simulated as non-member)";
        }

        var result = await resolver.ResolveAsync(foreign.Slug, userId, claims, ct);
        return Report("header_spoof", "403", result.StatusCode.ToString(), result.StatusCode == 403,
            (result.Error ?? "Spoofed tenant header was accepted") + note);
    }

    private async Task<SimulationResultDto> ForgedJwtAsync(Guid userId, IReadOnlyCollection<Guid> memberIds)
    {
        // Same issuer, audience and claims as a real token, signed with an attacker-controlled key.
        var attackerKey = new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(32));
        var forged = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _jwtOptions.Issuer,
            Audience = _jwtOptions.Audience,
            Expires = DateTime.UtcNow.AddMinutes(30),
            SigningCredentials = new SigningCredentials(attackerKey, SecurityAlgorithms.HmacSha256),
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = userId.ToString(),
                [JwtTokenService.TenantIdsClaim] = memberIds.Select(id => id.ToString()).ToArray(),
            },
        });

        var outcome = await _tokenService.ValidateTokenAsync(forged);
        return Report("forged_jwt", "401", outcome.IsValid ? "200" : "401", !outcome.IsValid,
            outcome.FailureReason ?? "Forged token was accepted");
    }

    private async Task<SimulationResultDto> CrossTenantReadAsync(Guid tenantId, Guid foreignProductId, CancellationToken ct)
    {
        await using var scope = CreateTenantScope(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var visible = await db.Products.AsNoTracking().AnyAsync(p => p.Id == foreignProductId, ct);

        return Report("cross_tenant_read", "404", visible ? "200" : "404", !visible,
            visible ? "Foreign product was visible" : "Not found (tenant-scoped filter)");
    }

    private async Task<SimulationResultDto> CrossTenantWriteAsync(Guid tenantId, Guid? otherTenantId, Guid foreignProductId, CancellationToken ct)
    {
        await using var scope = CreateTenantScope(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Step 1: the normal path. A filtered lookup can't find the target, so the API answers 404.
        var target = await db.Products.FirstOrDefaultAsync(p => p.Id == foreignProductId, ct);
        if (target is not null)
        {
            return Report("cross_tenant_write", "404", "200", false, "Foreign product was loadable for update");
        }

        // Step 2: bypass the filter by force-attaching a stub. The SaveChanges interceptor must reject it
        // before any SQL runs; the transaction is rolled back regardless.
        var interceptorBlocked = false;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            var stub = new Product
            {
                Id = foreignProductId,
                TenantId = otherTenantId ?? Guid.NewGuid(),
                Sku = "SIMULATED",
                Name = "Simulated cross-tenant write",
                Quantity = 0,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Products.Attach(stub).State = EntityState.Modified;
            await db.SaveChangesAsync(ct);
        }
        catch (TenantMismatchException)
        {
            interceptorBlocked = true;
        }
        finally
        {
            await transaction.RollbackAsync(CancellationToken.None);
            db.ChangeTracker.Clear();
        }

        return Report("cross_tenant_write", "404", "404", interceptorBlocked,
            interceptorBlocked
                ? "Not found (tenant-scoped filter); forced write rejected by SaveChanges interceptor"
                : "Forced write was not rejected by the SaveChanges interceptor");
    }

    private async Task<SimulationResultDto> PathTraversalAsync(Guid tenantId, Guid otherTenantId, CancellationToken ct)
    {
        const string maliciousFileName = "../../../tenants/other/products/evil.png";
        var key = StorageKeys.BuildProductImageKey(tenantId, Guid.NewGuid(), "image/png");
        var rewritten = StorageKeys.BelongsToTenant(tenantId, key)
                        && !key.Contains("evil", StringComparison.Ordinal)
                        && !key.Contains("..", StringComparison.Ordinal);

        // A traversal key pointing into another tenant must also be refused when presigning.
        var presignRefused = false;
        try
        {
            await _storage.GetPresignedUrlAsync(tenantId, $"{StorageKeys.TenantPrefix(tenantId)}../{otherTenantId}/products/x.png", TimeSpan.FromMinutes(5), ct);
        }
        catch (TenantMismatchException)
        {
            presignRefused = true;
        }

        var blocked = rewritten && presignRefused;
        return Report("path_traversal", "key rewritten", blocked ? "key rewritten" : "key accepted", blocked,
            blocked
                ? $"Server-generated key; \"{maliciousFileName}\" ignored"
                : "Client-controlled path reached storage");
    }

    private SimulationResultDto CacheProbe(Guid tenantId, Guid otherTenantId)
    {
        using var ownerScope = CreateTenantScope(tenantId);
        var ownerCache = ownerScope.ServiceProvider.GetRequiredService<ITenantCache>();
        ownerCache.Set(CacheProbeKey, Guid.NewGuid(), TimeSpan.FromSeconds(30));

        try
        {
            var rawHit = _memoryCache.TryGetValue(CacheProbeKey, out _);

            using var otherScope = CreateTenantScope(otherTenantId);
            var otherHit = otherScope.ServiceProvider.GetRequiredService<ITenantCache>().TryGet<Guid>(CacheProbeKey, out _);

            var blocked = !rawHit && !otherHit;
            return Report("cache_probe", "cache miss", blocked ? "cache miss" : "cache hit", blocked,
                blocked ? "Tenant-prefixed key required" : "Cached value readable outside its tenant");
        }
        finally
        {
            ownerCache.Remove(CacheProbeKey);
        }
    }

    private async Task<SimulationResultDto> RlsBypassAsync(CancellationToken ct)
    {
        var connectionString = _configuration.GetConnectionString("Default")
                               ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

        // A raw connection that skips EF entirely: no query filter, no interceptor, no app.tenant_id.
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await using (var roleCommand = new NpgsqlCommand(
                         "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user", connection))
        {
            if (await roleCommand.ExecuteScalarAsync(ct) is true)
            {
                return Report("rls_bypass_raw_sql", "0 rows", "role bypasses RLS", false,
                    "The API's database role is a superuser or has BYPASSRLS");
            }
        }

        await using var command = new NpgsqlCommand("SELECT count(*) FROM products", connection);
        var rows = Convert.ToInt64(await command.ExecuteScalarAsync(ct));

        return Report("rls_bypass_raw_sql", "0 rows", $"{rows} rows", rows == 0,
            rows == 0 ? "PostgreSQL RLS" : "Rows were returned without a tenant context");
    }

    private async Task<Tenant?> FindOtherTenantAsync(Guid tenantId, IReadOnlyCollection<Guid> memberIds, CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        return await db.Tenants.AsNoTracking()
            .Where(t => t.Id != tenantId)
            .OrderBy(t => memberIds.Contains(t.Id))
            .ThenBy(t => t.Slug)
            .FirstOrDefaultAsync(ct);
    }

    // Reads only an id, inside a scope legitimately bound to the other tenant.
    private async Task<Guid> FindForeignProductIdAsync(Guid otherTenantId, CancellationToken ct)
    {
        await using var scope = CreateTenantScope(otherTenantId);
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var id = await db.Products.AsNoTracking().OrderBy(p => p.Sku).Select(p => (Guid?)p.Id).FirstOrDefaultAsync(ct);
        return id ?? Guid.NewGuid();
    }

    private AsyncServiceScope CreateTenantScope(Guid tenantId)
    {
        var scope = _scopeFactory.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ITenantProvider>().SetTenant(tenantId);
        return scope;
    }

    private static SimulationResultDto Report(string attack, string expected, string actual, bool blocked, string reason) =>
        new(attack, expected, actual, blocked, reason);
}
