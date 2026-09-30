namespace TenantVault.Application.DTOs.Security;

public sealed record SimulationResultDto(string Attack, string Expected, string Actual, bool Blocked, string Reason);

public sealed record SecurityStatsDto(int LoginsToday, int FailedLogins, int CrossTenantAttempts, int BlockedRequests);

public sealed record LoginEventDto(Guid Id, string Email, bool Success, string? Ip, string? UserAgent, DateTime CreatedAt);

public sealed record CrossTenantAttemptDto(
    Guid Id,
    string? ActorEmail,
    string Method,
    string Path,
    string? TargetTenant,
    int Status,
    string Reason,
    DateTime CreatedAt);

public sealed record SecurityDashboardDto(
    SecurityStatsDto Stats,
    IReadOnlyList<LoginEventDto> RecentLogins,
    IReadOnlyList<CrossTenantAttemptDto> CrossTenantAttempts);
