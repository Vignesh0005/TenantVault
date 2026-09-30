using TenantVault.Domain.Entities;

namespace TenantVault.Application.Security;

public static class RolePermissions
{
    private static readonly IReadOnlyDictionary<Role, string[]> Map = new Dictionary<Role, string[]>
    {
        [Role.Admin] =
        [
            "products:read", "products:write", "products:delete", "images:write",
            "audit:read", "security:read", "export:read", "ai:use",
        ],
        [Role.Staff] =
        [
            "products:read", "products:write", "images:write", "security:read", "export:read", "ai:use",
        ],
        [Role.Viewer] = ["products:read", "ai:use"],
    };

    public static IReadOnlyList<string> For(Role role) => Map[role];
}
