using Microsoft.Extensions.Caching.Memory;
using TenantVault.Application.Interfaces;

namespace TenantVault.Infrastructure.Caching;

public sealed class TenantScopedCache : ITenantCache
{
    private readonly IMemoryCache _cache;
    private readonly ITenantProvider _tenantProvider;

    public TenantScopedCache(IMemoryCache cache, ITenantProvider tenantProvider)
    {
        _cache = cache;
        _tenantProvider = tenantProvider;
    }

    public string BuildKey(string key) => $"tenant:{_tenantProvider.RequireTenantId()}:{key}";

    public async Task<T> GetOrCreateAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct)
    {
        var fullKey = BuildKey(key);
        if (_cache.TryGetValue(fullKey, out T? cached) && cached is not null)
        {
            return cached;
        }

        var value = await factory(ct);
        _cache.Set(fullKey, value, ttl);
        return value;
    }

    public bool TryGet<T>(string key, out T? value) => _cache.TryGetValue(BuildKey(key), out value);

    public void Set<T>(string key, T value, TimeSpan ttl) => _cache.Set(BuildKey(key), value, ttl);

    public void Remove(string key) => _cache.Remove(BuildKey(key));
}
