using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;

namespace TenantVault.Api;

public sealed class RateLimitOptions
{
    public const string SectionName = "RateLimiting";

    public int AuthPerMinute { get; set; } = 10;
    public int SimulatorPerMinute { get; set; } = 10;
    public int GlobalPerMinute { get; set; } = 300;
}

public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Simulator = "simulator";

    public static IServiceCollection AddTenantVaultRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(_ => { });
        services.AddOptions<RateLimiterOptions>().Configure<IConfiguration>((options, configuration) =>
        {
            var limits = configuration.GetSection(RateLimitOptions.SectionName).Get<RateLimitOptions>() ?? new RateLimitOptions();

            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, ct) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
                }

                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { error = "Too many requests. Please slow down and try again shortly.", code = "RATE_LIMITED" }, ct);
            };

            // Brute-force protection for login/register, per client IP.
            options.AddPolicy(Auth, context => RateLimitPartition.GetFixedWindowLimiter(
                $"ip:{ClientIp(context)}", _ => PerMinute(limits.AuthPerMinute)));

            options.AddPolicy(Simulator, context => RateLimitPartition.GetFixedWindowLimiter(
                PartitionKey(context), _ => PerMinute(limits.SimulatorPerMinute)));

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(PartitionKey(context), _ => PerMinute(limits.GlobalPerMinute)));
        });
        return services;
    }

    private static FixedWindowRateLimiterOptions PerMinute(int permits) =>
        new() { PermitLimit = Math.Max(1, permits), Window = TimeSpan.FromMinutes(1), QueueLimit = 0 };

    private static string PartitionKey(HttpContext context) =>
        context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value is { } userId ? $"user:{userId}" : $"ip:{ClientIp(context)}";

    private static string ClientIp(HttpContext context) => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
