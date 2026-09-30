using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TenantVault.Application.DTOs.Audit;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.DTOs.Security;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Services;

public sealed class AuditService : IAuditService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly string[] DeniedActions = [AuditEntry.Actions.CrossTenantAttempt, AuditEntry.Actions.RoleDenied];
    private static readonly string[] FailureActions = [AuditEntry.Actions.LoginFailed];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly ILogger<AuditService> _logger;

    public AuditService(IServiceScopeFactory scopeFactory, IAppDbContext db, ICurrentUser currentUser, ILogger<AuditService> logger)
    {
        _scopeFactory = scopeFactory;
        _db = db;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task LogAsync(Guid? tenantId, Guid? userId, string action, string? resource, object? metadata, CancellationToken ct = default)
    {
        var targetTenant = tenantId ?? Tenant.SystemTenantId;
        try
        {
            // A dedicated scope binds the audit write to its own tenant (RLS + interceptor), independent of
            // the request's tenant, and keeps it out of the request's unit of work.
            await using var scope = _scopeFactory.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<ITenantProvider>().SetTenant(targetTenant);
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

            db.AuditEntries.Add(new AuditEntry
            {
                Id = Guid.NewGuid(),
                TenantId = targetTenant,
                UserId = userId,
                Action = action,
                Resource = resource,
                IpAddress = _currentUser.IpAddress,
                TraceId = Activity.Current?.Id ?? _currentUser.TraceId,
                Metadata = metadata is null ? null : JsonSerializer.Serialize(metadata, JsonOptions),
                Timestamp = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write audit entry {Action} for tenant {AuditTenantId}", action, targetTenant);
        }
    }

    public async Task<PagedResult<AuditEntryDto>> QueryAsync(AuditQuery query, CancellationToken ct)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var rows = from a in _db.AuditEntries.AsNoTracking()
                   join u in _db.Users.AsNoTracking() on a.UserId equals u.Id into users
                   from u in users.DefaultIfEmpty()
                   select new { Entry = a, Email = u != null ? u.Email : null };

        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            rows = rows.Where(r => r.Entry.Action == query.Action);
        }

        switch (query.Status)
        {
            case "denied":
                rows = rows.Where(r => DeniedActions.Contains(r.Entry.Action));
                break;
            case "failure":
                rows = rows.Where(r => FailureActions.Contains(r.Entry.Action));
                break;
            case "success":
                rows = rows.Where(r => !DeniedActions.Contains(r.Entry.Action) && !FailureActions.Contains(r.Entry.Action));
                break;
        }

        if (query.From is { } from)
        {
            var fromUtc = DateTime.SpecifyKind(from.Date, DateTimeKind.Utc);
            rows = rows.Where(r => r.Entry.Timestamp >= fromUtc);
        }

        if (query.To is { } to)
        {
            var toExclusive = DateTime.SpecifyKind(to.Date.AddDays(1), DateTimeKind.Utc);
            rows = rows.Where(r => r.Entry.Timestamp < toExclusive);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            rows = rows.Where(r =>
                (r.Email != null && r.Email.ToLower().Contains(term)) ||
                (r.Entry.Resource != null && r.Entry.Resource.ToLower().Contains(term)) ||
                r.Entry.Action.ToLower().Contains(term));
        }

        var total = await rows.CountAsync(ct);
        var items = await rows
            .OrderByDescending(r => r.Entry.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<AuditEntryDto>(items.Select(r => ToDto(r.Entry, r.Email)).ToList(), total, page, pageSize);
    }

    public async Task<SecurityDashboardDto> GetSecurityDashboardAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var todayStart = DateTime.SpecifyKind(now.Date, DateTimeKind.Utc);
        var dayAgo = now.AddHours(-24);
        var weekAgo = now.AddDays(-7);
        string[] blocked = [.. DeniedActions, .. FailureActions];

        var entries = _db.AuditEntries.AsNoTracking();
        var stats = new SecurityStatsDto(
            await entries.CountAsync(a => a.Action == AuditEntry.Actions.Login && a.Timestamp >= todayStart, ct),
            await entries.CountAsync(a => a.Action == AuditEntry.Actions.LoginFailed && a.Timestamp >= dayAgo, ct),
            await entries.CountAsync(a => a.Action == AuditEntry.Actions.CrossTenantAttempt && a.Timestamp >= weekAgo, ct),
            await entries.CountAsync(a => blocked.Contains(a.Action) && a.Timestamp >= weekAgo, ct));

        var logins = await (from a in entries
                            where a.Action == AuditEntry.Actions.Login || a.Action == AuditEntry.Actions.LoginFailed
                            join u in _db.Users.AsNoTracking() on a.UserId equals u.Id into users
                            from u in users.DefaultIfEmpty()
                            orderby a.Timestamp descending
                            select new { Entry = a, Email = u != null ? u.Email : null })
            .Take(10)
            .ToListAsync(ct);

        var attempts = await (from a in entries
                              where a.Action == AuditEntry.Actions.CrossTenantAttempt
                              join u in _db.Users.AsNoTracking() on a.UserId equals u.Id into users
                              from u in users.DefaultIfEmpty()
                              orderby a.Timestamp descending
                              select new { Entry = a, Email = u != null ? u.Email : null })
            .Take(20)
            .ToListAsync(ct);

        return new SecurityDashboardDto(
            stats,
            logins.Select(l =>
            {
                var meta = ParseMetadata(l.Entry.Metadata);
                return new LoginEventDto(
                    l.Entry.Id,
                    l.Email ?? GetString(meta, "email") ?? "unknown",
                    l.Entry.Action == AuditEntry.Actions.Login,
                    NullIfEmpty(l.Entry.IpAddress),
                    GetString(meta, "userAgent"),
                    l.Entry.Timestamp);
            }).ToList(),
            attempts.Select(a =>
            {
                var meta = ParseMetadata(a.Entry.Metadata);
                return new CrossTenantAttemptDto(
                    a.Entry.Id,
                    a.Email,
                    GetString(meta, "method") ?? "GET",
                    GetString(meta, "path") ?? a.Entry.Resource ?? "-",
                    GetString(meta, "targetTenant"),
                    GetInt(meta, "status") ?? 403,
                    GetString(meta, "reason") ?? "Blocked by tenant isolation",
                    a.Entry.Timestamp);
            }).ToList());
    }

    private static AuditEntryDto ToDto(AuditEntry entry, string? email)
    {
        var meta = ParseMetadata(entry.Metadata);
        string resourceType;
        string? resourceId = null;
        if (entry.Resource is { } resource && resource.Contains(':'))
        {
            var separator = resource.IndexOf(':');
            resourceType = resource[..separator];
            resourceId = resource[(separator + 1)..];
        }
        else
        {
            resourceType = entry.Resource ?? (entry.Action.StartsWith("login") ? "session" : entry.Action.Split('.')[0]);
        }

        var status = DeniedActions.Contains(entry.Action) ? "denied"
            : FailureActions.Contains(entry.Action) ? "failure"
            : "success";

        return new AuditEntryDto(
            entry.Id,
            email ?? GetString(meta, "email"),
            entry.Action,
            resourceType,
            resourceId,
            status,
            NullIfEmpty(entry.IpAddress),
            GetString(meta, "reason"),
            entry.TraceId,
            entry.Timestamp);
    }

    private static JsonElement? ParseMetadata(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object ? doc.RootElement.Clone() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? GetString(JsonElement? meta, string name) =>
        meta is { } m && m.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static int? GetInt(JsonElement? meta, string name) =>
        meta is { } m && m.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var i)
            ? i
            : null;

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;
}
