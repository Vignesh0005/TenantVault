namespace TenantVault.Tests.Infrastructure;

/// <summary>A fact that needs a Docker engine (Testcontainers). Skipped, not failed, when Docker is unavailable.</summary>
public sealed class DockerFactAttribute : FactAttribute
{
    public DockerFactAttribute()
    {
        if (!DockerEnvironment.IsAvailable)
        {
            Skip = "Docker is not available; Testcontainers-based test skipped.";
        }
    }
}

public static class DockerEnvironment
{
    public static bool IsAvailable { get; } = Detect();

    private static bool Detect()
    {
        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DOCKER_HOST")))
        {
            return true;
        }

        return OperatingSystem.IsWindows()
            ? File.Exists(@"\\.\pipe\docker_engine") || File.Exists(@"\\.\pipe\dockerDesktopLinuxEngine")
            : File.Exists("/var/run/docker.sock");
    }
}
