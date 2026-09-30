namespace TenantVault.Application.Interfaces;

/// <summary>
/// Cache that namespaces every key with the current tenant id. There is deliberately no way to
/// read or write an unprefixed key through this abstraction.
/// </summary>
public interface ITenantCache
{
    Task<T> GetOrCreateAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct);

    bool TryGet<T>(string key, out T? value);

    void Set<T>(string key, T value, TimeSpan ttl);

    void Remove(string key);

    /// <summary>The fully qualified key for the current tenant, e.g. <c>tenant:{id}:dashboard</c>.</summary>
    string BuildKey(string key);
}
