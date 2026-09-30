namespace TenantVault.Application.DTOs.Audit;

public sealed record AuditEntryDto(
    Guid Id,
    string? ActorEmail,
    string Action,
    string ResourceType,
    string? ResourceId,
    string Status,
    string? Ip,
    string? Reason,
    string TraceId,
    DateTime CreatedAt);

public sealed record AuditQuery(
    string? Search,
    string? Action,
    string? Status,
    DateTime? From,
    DateTime? To,
    int Page = 1,
    int PageSize = 25);
