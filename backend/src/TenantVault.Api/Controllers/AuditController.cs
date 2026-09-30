using Microsoft.AspNetCore.Mvc;
using TenantVault.Api.Filters;
using TenantVault.Application.DTOs.Audit;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Api.Controllers;

[Route("audit")]
[TenantRequired]
[RequireRole(Role.Admin)]
public sealed class AuditController : TenantControllerBase
{
    private readonly IAuditService _audit;

    public AuditController(IAuditService audit)
    {
        _audit = audit;
    }

    [HttpGet]
    public Task<PagedResult<AuditEntryDto>> List(
        [FromQuery] string? search,
        [FromQuery] string? action,
        [FromQuery] string? status,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        _audit.QueryAsync(new AuditQuery(search, action, status, from, to, page, pageSize), ct);
}
