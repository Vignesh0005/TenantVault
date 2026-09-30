using Microsoft.Extensions.Options;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;
using TenantVault.Domain.Entities;

namespace TenantVault.Api.Middleware;

/// <summary>
/// Resolves and verifies the tenant for every authenticated request, binds it to the scoped
/// <see cref="ITenantProvider"/> and locks it. Runs after authentication and before authorization.
/// </summary>
public sealed class TenantMiddleware
{
    private static readonly string[] SkippedPrefixes = ["/auth/", "/health", "/swagger", "/security/simulate-attack"];
    private static readonly string[] SkippedExactPaths = ["/me", "/tenants"];

    private readonly RequestDelegate _next;
    private readonly ILogger<TenantMiddleware> _logger;

    public TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(
        HttpContext context,
        ITenantProvider tenantProvider,
        ICurrentUser currentUser,
        TenantResolver resolver,
        IAuditService audit,
        IOptions<TenancyOptions> options)
    {
        // Unauthenticated requests are left for authorization to reject with 401; no tenant is ever inferred.
        if (HttpMethods.IsOptions(context.Request.Method) || IsSkipped(context.Request.Path) || currentUser.UserId is not { } userId)
        {
            await _next(context);
            return;
        }

        var identifier = TenantIdentifier.Resolve(context, options.Value);
        var result = await resolver.ResolveAsync(identifier, userId, currentUser.TenantIds, context.RequestAborted);

        if (!result.Succeeded)
        {
            if (result.StatusCode == StatusCodes.Status403Forbidden && result.Tenant is not null)
            {
                await AuditCrossTenantAttemptAsync(context, audit, currentUser, userId, result.Tenant);
            }

            context.Response.StatusCode = result.StatusCode;
            await context.Response.WriteAsJsonAsync(new { error = result.Error, code = result.Code }, context.RequestAborted);
            return;
        }

        tenantProvider.SetTenant(result.Tenant!.Id, result.Tenant.Slug, result.Role);
        await _next(context);
    }

    private async Task AuditCrossTenantAttemptAsync(HttpContext context, IAuditService audit, ICurrentUser currentUser, Guid userId, Tenant target)
    {
        _logger.LogWarning("Cross-tenant attempt: user {AttemptUserId} requested tenant {TargetTenant} ({Method} {Path})",
            userId, target.Slug, context.Request.Method, context.Request.Path.Value);

        var metadata = new
        {
            method = context.Request.Method,
            path = context.Request.Path.Value,
            targetTenant = target.Slug,
            status = StatusCodes.Status403Forbidden,
            reason = TenantResolver.ForbiddenError,
            email = currentUser.Email,
        };

        // Visible to the targeted tenant's admins and to the attacker's own tenants.
        var tenantIds = currentUser.TenantIds.Where(id => id != target.Id).Prepend(target.Id);
        foreach (var tenantId in tenantIds)
        {
            await audit.LogAsync(tenantId, userId, AuditEntry.Actions.CrossTenantAttempt, $"tenant:{target.Id}", metadata, CancellationToken.None);
        }
    }

    private static bool IsSkipped(PathString path)
    {
        var value = path.Value ?? string.Empty;
        return SkippedPrefixes.Any(p => value.StartsWith(p, StringComparison.OrdinalIgnoreCase))
               || SkippedExactPaths.Any(p => value.TrimEnd('/').Equals(p, StringComparison.OrdinalIgnoreCase));
    }
}
