using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;

namespace TenantVault.Api.Filters;

/// <summary>
/// Fails closed if an action that needs tenant data runs without a verified tenant binding
/// (for example if the path was accidentally added to the middleware skip list).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class TenantRequiredAttribute : Attribute, IAuthorizationFilter, IOrderedFilter
{
    public int Order => -1000;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var provider = context.HttpContext.RequestServices.GetRequiredService<ITenantProvider>();
        if (provider.TenantId is null || !provider.IsLocked)
        {
            context.Result = new ObjectResult(new { error = TenantResolver.MissingError, code = "TENANT_MISSING" })
            {
                StatusCode = StatusCodes.Status400BadRequest,
            };
        }
    }
}
