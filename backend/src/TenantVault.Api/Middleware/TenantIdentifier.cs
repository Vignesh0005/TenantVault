namespace TenantVault.Api.Middleware;

public sealed class TenancyOptions
{
    public const string SectionName = "Tenancy";
    public const string HeaderName = "X-Tenant-Id";

    /// <summary>Host suffix for subdomain resolution, e.g. <c>localhost</c> makes <c>acme.localhost</c> resolve to <c>acme</c>.</summary>
    public string BaseDomain { get; set; } = "localhost";
}

public static class TenantIdentifier
{
    /// <summary>Subdomain first, then the <c>X-Tenant-Id</c> header. Returns null when neither is present.</summary>
    public static string? Resolve(HttpContext context, TenancyOptions options)
    {
        var host = context.Request.Host.Host;
        var suffix = "." + options.BaseDomain.Trim('.');
        if (!string.IsNullOrEmpty(options.BaseDomain)
            && host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)
            && host.Length > suffix.Length)
        {
            var label = host[..^suffix.Length].Split('.')[0];
            if (!string.IsNullOrWhiteSpace(label) && !label.Equals("www", StringComparison.OrdinalIgnoreCase))
            {
                return label;
            }
        }

        var header = context.Request.Headers[TenancyOptions.HeaderName].ToString();
        return string.IsNullOrWhiteSpace(header) ? null : header.Trim();
    }
}
