using TenantVault.Application.DTOs.Auth;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.DTOs.Tenants;

public sealed record TenantDto(Guid Id, string Slug, string Name, string Role)
{
    public static TenantDto From(Tenant tenant, Role role) =>
        new(tenant.Id, tenant.Slug, tenant.Name, role.ToString().ToLowerInvariant());
}

public sealed record MeResponse(UserDto User, IReadOnlyList<TenantDto> Tenants);

public sealed record CreateTenantRequest(string Name);

public sealed record SecurityContextDto(TenantDto Tenant, string Role, IReadOnlyList<string> Permissions);
