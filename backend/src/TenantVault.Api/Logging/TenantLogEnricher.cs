using Microsoft.IdentityModel.JsonWebTokens;
using Serilog.Core;
using Serilog.Events;
using TenantVault.Application.Interfaces;

namespace TenantVault.Api.Logging;

/// <summary>Adds <c>TenantId</c> and <c>UserId</c> to every log event written during a request.</summary>
public sealed class TenantLogEnricher : ILogEventEnricher
{
    private readonly IHttpContextAccessor _accessor;

    public TenantLogEnricher(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var context = _accessor.HttpContext;
        if (context is null)
        {
            return;
        }

        var tenantId = context.RequestServices.GetService<ITenantProvider>()?.TenantId;
        var userId = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty("TenantId", tenantId?.ToString() ?? "none"));
        logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty("UserId", userId ?? "anonymous"));
    }
}
