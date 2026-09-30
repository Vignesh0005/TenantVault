using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TenantVault.Application.Interfaces;

namespace TenantVault.Api.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
public abstract class TenantControllerBase : ControllerBase
{
    private ITenantProvider TenantProvider => HttpContext.RequestServices.GetRequiredService<ITenantProvider>();
    private ICurrentUser CurrentUser => HttpContext.RequestServices.GetRequiredService<ICurrentUser>();

    /// <summary>The verified tenant for this request, or null on tenant-agnostic endpoints.</summary>
    protected Guid? CurrentTenantId => TenantProvider.TenantId;

    protected Guid? CurrentUserId => CurrentUser.UserId;

    protected Guid RequireUserId() => CurrentUser.RequireUserId();
}
