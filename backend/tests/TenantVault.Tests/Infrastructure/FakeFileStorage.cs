using System.Collections.Concurrent;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;

namespace TenantVault.Tests.Infrastructure;

/// <summary>In-memory storage that applies the same key rules as S3FileStorage.</summary>
public sealed class FakeFileStorage : IFileStorage
{
    private readonly ConcurrentDictionary<string, byte[]> _objects = new();

    public async Task<string> UploadAsync(Guid tenantId, Guid productId, Stream stream, string contentType, CancellationToken ct)
    {
        var key = StorageKeys.BuildProductImageKey(tenantId, productId, contentType);
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        _objects[key] = buffer.ToArray();
        return key;
    }

    public Task<string> GetPresignedUrlAsync(Guid tenantId, string key, TimeSpan ttl, CancellationToken ct)
    {
        StorageKeys.EnsureBelongsToTenant(tenantId, key);
        return Task.FromResult($"http://fake-storage/{key}?expires={DateTimeOffset.UtcNow.Add(ttl).ToUnixTimeSeconds()}");
    }

    public Task DeleteAsync(Guid tenantId, string key, CancellationToken ct)
    {
        StorageKeys.EnsureBelongsToTenant(tenantId, key);
        _objects.TryRemove(key, out _);
        return Task.CompletedTask;
    }
}
