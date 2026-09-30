using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Api.Filters;

/// <summary>Restricts an action to the given tenant roles. Denials are explained and audited as <c>role_denied</c>.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireRoleAttribute : Attribute, IAsyncAuthorizationFilter, IOrderedFilter
{
    private readonly Role[] _roles;

    public RequireRoleAttribute(params Role[] roles)
    {
        _roles = roles;
    }

    public int Order => -900;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.Result is not null || context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var services = context.HttpContext.RequestServices;
        var provider = services.GetRequiredService<ITenantProvider>();
        if (provider.Role is { } role && _roles.Contains(role))
        {
            return;
        }

        var roleName = provider.Role?.ToString().ToLowerInvariant() ?? "none";
        var allowed = string.Join(", ", _roles.Select(r => r.ToString().ToLowerInvariant()));
        var message = $"Your role ({roleName}) cannot perform this action in {provider.TenantSlug ?? "this tenant"}. Required: {allowed}.";

        var currentUser = services.GetRequiredService<ICurrentUser>();
        await services.GetRequiredService<IAuditService>().LogAsync(
            provider.TenantId,
            currentUser.UserId,
            AuditEntry.Actions.RoleDenied,
            context.HttpContext.Request.Path.Value,
            new { method = context.HttpContext.Request.Method, role = roleName, required = allowed, status = 403, reason = message },
            CancellationToken.None);

        context.Result = new ObjectResult(new { error = message, code = "ROLE_FORBIDDEN" })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
