namespace TenantVault.Application.Interfaces;

public interface IFileStorage
{
    /// <summary>Uploads under a server-generated, tenant-prefixed key and returns that key.</summary>
    Task<string> UploadAsync(Guid tenantId, Guid productId, Stream stream, string contentType, CancellationToken ct);

    /// <summary>Returns a short-lived GET URL. Throws if <paramref name="key"/> is not under the tenant's prefix.</summary>
    Task<string> GetPresignedUrlAsync(Guid tenantId, string key, TimeSpan ttl, CancellationToken ct);

    Task DeleteAsync(Guid tenantId, string key, CancellationToken ct);
}
