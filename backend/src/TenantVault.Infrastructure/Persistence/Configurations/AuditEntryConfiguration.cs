using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TenantVault.Domain.Entities;

namespace TenantVault.Infrastructure.Persistence.Configurations;

public sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("audit_entries");
        builder.HasKey(a => a.Id);

        // No FK to tenants: system-level events use the all-zero system tenant id.
        builder.Property(a => a.TenantId).IsRequired();
        builder.Property(a => a.Action).IsRequired().HasMaxLength(64);
        builder.Property(a => a.Resource).HasMaxLength(200);
        builder.Property(a => a.IpAddress).IsRequired().HasMaxLength(64);
        builder.Property(a => a.TraceId).IsRequired().HasMaxLength(128);
        builder.Property(a => a.Metadata).HasColumnType("jsonb");
        builder.Property(a => a.Timestamp).IsRequired();

        builder.HasIndex(a => new { a.TenantId, a.Timestamp }).IsDescending(false, true);
        builder.HasIndex(a => new { a.TenantId, a.Action, a.Timestamp });
    }
}
