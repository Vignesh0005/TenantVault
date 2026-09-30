using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;
using TenantVault.Domain.Entities;
using TenantVault.Infrastructure.Persistence;
using TenantVault.Infrastructure.Persistence.Interceptors;
using TenantVault.Infrastructure.Storage;

namespace TenantVault.Infrastructure.Seeding;

/// <summary>
/// Development/test bootstrap: applies migrations as the schema owner, enables login for the
/// least-privilege app role, and seeds demo tenants, users, products, movements and audit entries.
/// </summary>
public static partial class DatabaseSeeder
{
    public const string DemoPassword = "Password123!";
    public const string AppRoleName = "tenantvault_app";

    private enum Profile { Steady, Fast, Low, Dead, Spike }

    private sealed record ProductSeed(string Sku, string Name, string Category, decimal Price, Profile Profile);

    private sealed record TenantSeed(string Name, string Slug, ProductSeed[] Products);

    private static readonly TenantSeed[] Tenants =
    [
        new("Acme Corp", "acme-corp",
        [
            new("SKU-001", "Wireless Keyboard", "Peripherals", 49.99m, Profile.Fast),
            new("SKU-002", "Ergonomic Mouse", "Peripherals", 29.50m, Profile.Steady),
            new("SKU-003", "27\" 4K Monitor", "Displays", 329.00m, Profile.Steady),
            new("SKU-004", "USB-C Docking Station", "Accessories", 139.00m, Profile.Low),
            new("SKU-005", "Noise-Cancelling Headset", "Audio", 179.99m, Profile.Spike),
            new("SKU-006", "Laptop Stand", "Accessories", 39.00m, Profile.Steady),
            new("SKU-007", "1080p Webcam", "Peripherals", 69.00m, Profile.Low),
            new("SKU-008", "HDMI Cable 2m", "Cables", 9.99m, Profile.Fast),
            new("SKU-009", "Mechanical Keyboard", "Peripherals", 119.00m, Profile.Dead),
            new("SKU-010", "Portable SSD 1TB", "Storage", 99.00m, Profile.Steady),
            new("SKU-011", "Desk Lamp LED", "Office", 34.00m, Profile.Dead),
            new("SKU-012", "Surge Protector", "Power", 24.99m, Profile.Steady),
        ]),
        new("Globex Ltd", "globex-ltd",
        [
            new("SKU-001", "Hydraulic Pump", "Hydraulics", 849.00m, Profile.Steady),
            new("SKU-002", "Steel Bearing 40mm", "Bearings", 12.40m, Profile.Fast),
            new("SKU-003", "Pressure Gauge", "Instruments", 58.00m, Profile.Low),
            new("SKU-004", "Industrial Belt", "Drive Parts", 45.00m, Profile.Steady),
            new("SKU-005", "Safety Valve", "Hydraulics", 132.00m, Profile.Spike),
            new("SKU-006", "Torque Wrench", "Tools", 210.00m, Profile.Dead),
            new("SKU-007", "Welding Rods (pack)", "Consumables", 18.00m, Profile.Fast),
            new("SKU-008", "Coolant 5L", "Consumables", 27.50m, Profile.Steady),
            new("SKU-009", "Gear Motor 0.5kW", "Drive Parts", 389.00m, Profile.Low),
            new("SKU-010", "Hex Bolt M12 (box)", "Fasteners", 15.00m, Profile.Fast),
            new("SKU-011", "Flow Meter", "Instruments", 275.00m, Profile.Dead),
        ]),
        new("Initech", "initech",
        [
            new("SKU-001", "TPS Report Binder", "Stationery", 6.50m, Profile.Fast),
            new("SKU-002", "Red Stapler", "Stationery", 21.00m, Profile.Low),
            new("SKU-003", "Printer Toner", "Printing", 89.00m, Profile.Spike),
            new("SKU-004", "Copy Paper (ream)", "Printing", 5.25m, Profile.Fast),
            new("SKU-005", "Cubicle Nameplate", "Office", 14.00m, Profile.Dead),
            new("SKU-006", "Office Chair", "Furniture", 249.00m, Profile.Steady),
            new("SKU-007", "Whiteboard Markers", "Stationery", 8.75m, Profile.Steady),
            new("SKU-008", "Coffee Filters", "Break Room", 4.20m, Profile.Fast),
            new("SKU-009", "Desk Organizer", "Office", 19.00m, Profile.Steady),
            new("SKU-010", "Filing Cabinet", "Furniture", 199.00m, Profile.Dead),
            new("SKU-011", "Label Maker", "Office", 45.00m, Profile.Low),
        ]),
    ];

    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        var configuration = services.GetRequiredService<IConfiguration>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DatabaseSeeder));
        var appConnection = configuration.GetConnectionString("Default")
                            ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");
        var ownerConnection = configuration.GetConnectionString("Migrations") ?? appConnection;

        await using (var context = CreateContext(ownerConnection, new TenantProvider()))
        {
            await context.Database.MigrateAsync(ct);
        }

        logger.LogInformation("Database migrations applied");

        await EnableAppRoleLoginAsync(ownerConnection, appConnection, logger, ct);
        await SeedDemoDataAsync(ownerConnection, services.GetRequiredService<IPasswordHasher>(), logger, ct);
        await VerifyAppRoleAsync(appConnection, logger, ct);

        if (services.GetRequiredService<IFileStorage>() is S3FileStorage s3)
        {
            try
            {
                await s3.EnsureBucketAsync(ct);
                logger.LogInformation("S3 bucket ready (public access blocked, SSE-S3 default encryption)");
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "S3 is unreachable; image uploads will fail until it is available");
            }
        }
    }

    private static AppDbContext CreateContext(string connectionString, ITenantProvider tenantProvider)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .AddInterceptors(
                new TenantSaveChangesInterceptor(tenantProvider),
                new TenantConnectionInterceptor(tenantProvider))
            .Options;
        return new AppDbContext(options, tenantProvider);
    }

    /// <summary>The migration creates the role as NOLOGIN; development sets its password from the app connection string.</summary>
    private static async Task EnableAppRoleLoginAsync(string ownerConnection, string appConnection, ILogger logger, CancellationToken ct)
    {
        var owner = new NpgsqlConnectionStringBuilder(ownerConnection);
        var app = new NpgsqlConnectionStringBuilder(appConnection);

        if (string.Equals(owner.Username, app.Username, StringComparison.Ordinal))
        {
            logger.LogWarning("The API connects with the schema owner ({User}); RLS will not protect it. Use the {Role} role", app.Username, AppRoleName);
            return;
        }

        if (!string.Equals(app.Username, AppRoleName, StringComparison.Ordinal) || !RoleNamePattern().IsMatch(app.Username!))
        {
            logger.LogWarning("App connection uses role {User}; expected {Role}. Skipping role password setup", app.Username, AppRoleName);
            return;
        }

        var password = (app.Password ?? string.Empty).Replace("'", "''");
        await using var connection = new NpgsqlConnection(ownerConnection);
        await connection.OpenAsync(ct);
        // Role DDL cannot take bind parameters; the name is fixed and the password is quote-escaped.
        await using var command = new NpgsqlCommand($"ALTER ROLE {AppRoleName} WITH LOGIN PASSWORD '{password}'", connection);
        await command.ExecuteNonQueryAsync(ct);
    }

    private static async Task VerifyAppRoleAsync(string appConnection, ILogger logger, CancellationToken ct)
    {
        await using var connection = new NpgsqlConnection(appConnection);
        await connection.OpenAsync(ct);
        await using var command = new NpgsqlCommand(
            "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user", connection);
        if (await command.ExecuteScalarAsync(ct) is true)
        {
            logger.LogCritical("The API database role bypasses RLS (superuser or BYPASSRLS). The database isolation layer is inactive");
        }
    }

    private static async Task SeedDemoDataAsync(string connectionString, IPasswordHasher hasher, ILogger logger, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        Dictionary<string, Guid> tenantIds;
        Dictionary<string, Guid> userIds;

        await using (var context = CreateContext(connectionString, new TenantProvider()))
        {
            if (await context.Tenants.AnyAsync(ct))
            {
                logger.LogInformation("Seed data already present; skipping");
                return;
            }

            var tenants = Tenants.Select(t => new Tenant
            {
                Id = Guid.NewGuid(),
                Name = t.Name,
                Slug = t.Slug,
                CreatedAt = now.AddDays(-120),
            }).ToList();
            tenantIds = tenants.ToDictionary(t => t.Slug, t => t.Id);

            var passwordHash = hasher.Hash(DemoPassword);
            var users = new[] { "acme@demo.com", "globex@demo.com", "initech@demo.com", "multi@demo.com" }
                .Select(email => new User { Id = Guid.NewGuid(), Email = email, PasswordHash = passwordHash, CreatedAt = now.AddDays(-100) })
                .ToList();
            userIds = users.ToDictionary(u => u.Email, u => u.Id);

            var memberships = new List<Membership>
            {
                new() { UserId = userIds["acme@demo.com"], TenantId = tenantIds["acme-corp"], Role = Role.Admin },
                new() { UserId = userIds["globex@demo.com"], TenantId = tenantIds["globex-ltd"], Role = Role.Admin },
                new() { UserId = userIds["initech@demo.com"], TenantId = tenantIds["initech"], Role = Role.Admin },
                new() { UserId = userIds["multi@demo.com"], TenantId = tenantIds["acme-corp"], Role = Role.Admin },
                new() { UserId = userIds["multi@demo.com"], TenantId = tenantIds["globex-ltd"], Role = Role.Staff },
                new() { UserId = userIds["multi@demo.com"], TenantId = tenantIds["initech"], Role = Role.Viewer },
            };
            memberships.ForEach(m => m.CreatedAt = now.AddDays(-100));

            context.Tenants.AddRange(tenants);
            context.Users.AddRange(users);
            context.Memberships.AddRange(memberships);
            await context.SaveChangesAsync(ct);
        }

        var ownerEmail = new Dictionary<string, string>
        {
            ["acme-corp"] = "acme@demo.com",
            ["globex-ltd"] = "globex@demo.com",
            ["initech"] = "initech@demo.com",
        };

        var random = new Random(42);
        foreach (var seed in Tenants)
        {
            var tenantId = tenantIds[seed.Slug];
            var actorId = userIds[ownerEmail[seed.Slug]];
            var provider = new TenantProvider();
            provider.SetTenant(tenantId, seed.Slug);

            await using var context = CreateContext(connectionString, provider);
            foreach (var productSeed in seed.Products)
            {
                var product = new Product
                {
                    Id = Guid.NewGuid(),
                    Sku = productSeed.Sku,
                    Name = productSeed.Name,
                    Category = productSeed.Category,
                    Price = productSeed.Price,
                    CreatedAt = now.AddDays(-90),
                };
                var movements = SimulateMovements(product, productSeed.Profile, actorId, now, random);
                product.UpdatedAt = movements.Count > 0 ? movements[^1].Timestamp : product.CreatedAt;
                context.Products.Add(product);
                context.StockMovements.AddRange(movements);
            }

            context.AuditEntries.AddRange(DemoAuditEntries(seed.Slug, actorId, userIds, tenantIds, now));
            await context.SaveChangesAsync(ct);
        }

        logger.LogInformation("Seeded {Tenants} tenants, 4 demo users (password {Password})", Tenants.Length, DemoPassword);
    }

    /// <summary>Plays out ~60 days of stock history; the product's quantity is whatever the history leaves.</summary>
    private static List<StockMovement> SimulateMovements(Product product, Profile profile, Guid userId, DateTime now, Random random)
    {
        var movements = new List<StockMovement>();
        var quantity = 0;

        void Add(DateTime timestamp, int delta, string reason)
        {
            quantity += delta;
            movements.Add(new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                Delta = delta,
                Reason = reason,
                UserId = userId,
                Timestamp = timestamp,
                ResultingQuantity = quantity,
            });
        }

        if (profile == Profile.Dead)
        {
            Add(now.AddDays(-80), 40 + random.Next(30), StockMovement.Reasons.Restock);
            Add(now.AddDays(-72), -(2 + random.Next(4)), StockMovement.Reasons.Sale);
            product.Quantity = quantity;
            return movements;
        }

        var (initial, minSale, maxSale, saleChance, restockAt, restockQty) = profile switch
        {
            Profile.Fast => (120, 3, 9, 0.85, 20, 90),
            Profile.Low => (60, 1, 4, 0.7, -1, 0),
            _ => (80, 1, 5, 0.55, 15, 50),
        };

        Add(now.AddDays(-60).AddHours(9), initial, StockMovement.Reasons.Restock);

        for (var day = 59; day >= 1; day--)
        {
            var timestamp = now.AddDays(-day).AddHours(10 + random.Next(8)).AddMinutes(random.Next(60));

            if (random.NextDouble() < saleChance && quantity > 0)
            {
                var sale = Math.Min(quantity, random.Next(minSale, maxSale + 1));
                var reason = random.NextDouble() < 0.2 ? StockMovement.Reasons.Scan : StockMovement.Reasons.Sale;
                Add(timestamp, -sale, reason);
            }

            if (profile == Profile.Spike && day == 4)
            {
                if (quantity < 60) Add(timestamp.AddMinutes(-30), 80, StockMovement.Reasons.Restock);
                Add(timestamp.AddMinutes(30), -55, StockMovement.Reasons.Sale);
            }

            if (restockAt > 0 && quantity <= restockAt)
            {
                Add(timestamp.AddHours(2), restockQty, StockMovement.Reasons.Restock);
            }

            if (day == 30 && random.NextDouble() < 0.5 && quantity > 2)
            {
                Add(timestamp.AddHours(1), -1, StockMovement.Reasons.Adjustment);
            }
        }

        if (profile == Profile.Low && quantity > 8)
        {
            Add(now.AddHours(-6), -(quantity - (1 + random.Next(7))), StockMovement.Reasons.Sale);
        }

        product.Quantity = quantity;
        return movements;
    }

    private static IEnumerable<AuditEntry> DemoAuditEntries(
        string slug,
        Guid ownerId,
        IReadOnlyDictionary<string, Guid> userIds,
        IReadOnlyDictionary<string, Guid> tenantIds,
        DateTime now)
    {
        static string Json(object value) => JsonSerializer.Serialize(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        AuditEntry Entry(Guid? userId, string action, string? resource, object? metadata, DateTime timestamp) => new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Action = action,
            Resource = resource,
            IpAddress = "10.0.0." + (Math.Abs(action.GetHashCode()) % 200 + 10),
            TraceId = $"seed-{Guid.NewGuid():N}",
            Metadata = metadata is null ? null : Json(metadata),
            Timestamp = timestamp,
        };

        yield return Entry(ownerId, AuditEntry.Actions.Login, null, new { email = $"{slug.Split('-')[0]}@demo.com" }, now.AddDays(-2));
        yield return Entry(ownerId, AuditEntry.Actions.Login, null, new { email = $"{slug.Split('-')[0]}@demo.com" }, now.AddHours(-20));
        yield return Entry(ownerId, AuditEntry.Actions.LoginFailed, null, new { reason = "Wrong password" }, now.AddHours(-21));
        yield return Entry(ownerId, AuditEntry.Actions.ProductCreate, "products", new { note = "Initial catalogue import" }, now.AddDays(-90));

        // A blocked probe from another tenant's user, so the security dashboard has history on first run.
        var (attackerEmail, attackerTenant) = slug == "acme-corp" ? ("globex@demo.com", "globex-ltd") : ("acme@demo.com", "acme-corp");
        yield return Entry(userIds[attackerEmail], AuditEntry.Actions.CrossTenantAttempt, $"tenant:{tenantIds[slug]}",
            new
            {
                method = "GET",
                path = "/products",
                targetTenant = slug,
                status = 403,
                reason = "You are not a member of this tenant",
                homeTenant = attackerTenant,
            },
            now.AddHours(-5));
    }

    [GeneratedRegex("^[a-z_][a-z0-9_]*$")]
    private static partial Regex RoleNamePattern();
}
