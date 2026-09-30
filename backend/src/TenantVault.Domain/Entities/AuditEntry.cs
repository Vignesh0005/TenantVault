using TenantVault.Domain.Interfaces;

namespace TenantVault.Domain.Entities;

public class AuditEntry : ITenantEntity
{
    public static class Actions
    {
        public const string Login = "login";
        public const string LoginFailed = "login_failed";
        public const string ProductCreate = "product.create";
        public const string ProductUpdate = "product.update";
        public const string ProductDelete = "product.delete";
        public const string ProductScan = "product.scan";
        public const string ImageUpload = "image.upload";
        public const string ImageDelete = "image.delete";
        public const string TenantSwitch = "tenant.switch";
        public const string TenantCreate = "tenant.create";
        public const string CrossTenantAttempt = "cross_tenant_attempt";
        public const string RoleDenied = "role_denied";
        public const string Export = "export";
    }

    public Guid Id { get; set; }

    /// <summary>Events without a tenant (e.g. unknown-user logins) use <see cref="Tenant.SystemTenantId"/>.</summary>
    public Guid TenantId { get; set; }

    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Resource { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public string TraceId { get; set; } = string.Empty;

    /// <summary>Serialized JSON, stored as <c>jsonb</c>.</summary>
    public string? Metadata { get; set; }

    public DateTime Timestamp { get; set; }
}
