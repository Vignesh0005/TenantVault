using TenantVault.Application.Exceptions;
using TenantVault.Domain.Exceptions;

namespace TenantVault.Application.Services;

/// <summary>Server-side rules for object keys. Client-supplied filenames never influence a key.</summary>
public static class StorageKeys
{
    public static readonly IReadOnlyDictionary<string, string> AllowedContentTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["image/png"] = ".png",
        ["image/jpeg"] = ".jpg",
        ["image/webp"] = ".webp",
    };

    public static string TenantPrefix(Guid tenantId) => $"tenants/{tenantId}/";

    public static string BuildProductImageKey(Guid tenantId, Guid productId, string contentType)
    {
        if (!AllowedContentTypes.TryGetValue(contentType, out var extension))
        {
            throw new BadRequestException("Only PNG, JPEG or WebP images are allowed.", "UNSUPPORTED_MEDIA_TYPE");
        }

        return $"{TenantPrefix(tenantId)}products/{productId}/{Guid.NewGuid()}{extension}";
    }

    public static bool BelongsToTenant(Guid tenantId, string key) =>
        !string.IsNullOrWhiteSpace(key)
        && key.StartsWith(TenantPrefix(tenantId), StringComparison.Ordinal)
        && !key.Contains("..", StringComparison.Ordinal)
        && !key.Contains('\\');

    public static void EnsureBelongsToTenant(Guid tenantId, string key)
    {
        if (!BelongsToTenant(tenantId, key))
        {
            throw new TenantMismatchException("The requested file does not belong to the current tenant.");
        }
    }
}
