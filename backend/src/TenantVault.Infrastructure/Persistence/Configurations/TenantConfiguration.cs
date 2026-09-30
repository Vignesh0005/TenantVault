using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TenantVault.Domain.Entities;

namespace TenantVault.Infrastructure.Persistence.Configurations;

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants", t => t.HasCheckConstraint("ck_tenants_slug_format", "slug ~ '^[a-z0-9-]+$'"));
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Name).IsRequired().HasMaxLength(100);
        builder.Property(t => t.Slug).IsRequired().HasMaxLength(63);
        builder.Property(t => t.CreatedAt).IsRequired();
        builder.HasIndex(t => t.Slug).IsUnique();
    }
}
