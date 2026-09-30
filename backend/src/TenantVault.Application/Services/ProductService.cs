using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.Exceptions;
using TenantVault.Application.Interfaces;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Services;

public sealed class ProductService
{
    public const string DashboardCacheKey = "dashboard";
    public const long MaxImageBytes = 5 * 1024 * 1024;
    public static readonly TimeSpan ImageUrlTtl = TimeSpan.FromMinutes(5);

    private readonly IAppDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly ICurrentUser _currentUser;
    private readonly IAuditService _audit;
    private readonly IFileStorage _storage;
    private readonly ITenantCache _cache;
    private readonly InventoryOptions _options;

    public ProductService(
        IAppDbContext db,
        ITenantProvider tenantProvider,
        ICurrentUser currentUser,
        IAuditService audit,
        IFileStorage storage,
        ITenantCache cache,
        IOptions<InventoryOptions> options)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        _currentUser = currentUser;
        _audit = audit;
        _storage = storage;
        _cache = cache;
        _options = options.Value;
    }

    private Guid TenantId => _tenantProvider.RequireTenantId();

    public async Task<PagedResult<ProductDto>> ListAsync(ProductQuery query, CancellationToken ct)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var products = _db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            products = products.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            products = products.Where(p => p.Category == query.Category);
        }

        var total = await products.CountAsync(ct);
        var items = await products
            .OrderBy(p => p.Name).ThenBy(p => p.Sku)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var dtos = new List<ProductDto>(items.Count);
        foreach (var product in items)
        {
            dtos.Add(await ToDtoAsync(product, ct));
        }

        return new PagedResult<ProductDto>(dtos, total, page, pageSize);
    }

    public async Task<IReadOnlyList<string>> GetCategoriesAsync(CancellationToken ct) =>
        await _db.Products.AsNoTracking()
            .Where(p => p.Category != null)
            .Select(p => p.Category!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);

    public async Task<ProductDto> GetAsync(Guid id, CancellationToken ct) =>
        await ToDtoAsync(await FindScopedAsync(id, track: false, ct), ct);

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct)
    {
        var sku = request.Sku.Trim();
        if (await _db.Products.AnyAsync(p => p.Sku == sku, ct))
        {
            throw new ConflictException($"A product with SKU '{sku}' already exists in this tenant.");
        }

        var now = DateTime.UtcNow;
        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = sku,
            Name = request.Name.Trim(),
            Category = NormalizeCategory(request.Category),
            Price = request.Price,
            Quantity = request.Quantity,
            CreatedAt = now,
            UpdatedAt = now,
        };
        _db.Products.Add(product);

        if (product.Quantity > 0)
        {
            AddMovement(product, product.Quantity, StockMovement.Reasons.Restock, now);
        }

        await SaveHandlingConflictsAsync(sku, ct);
        _cache.Remove(DashboardCacheKey);
        await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.ProductCreate, Resource(product.Id),
            new { product.Sku, product.Name }, ct);

        return await ToDtoAsync(product, ct);
    }

    public async Task<ProductDto> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken ct)
    {
        var product = await FindScopedAsync(id, track: true, ct);
        var sku = request.Sku.Trim();

        if (sku != product.Sku && await _db.Products.AnyAsync(p => p.Sku == sku && p.Id != id, ct))
        {
            throw new ConflictException($"A product with SKU '{sku}' already exists in this tenant.");
        }

        var now = DateTime.UtcNow;
        var delta = request.Quantity - product.Quantity;
        var changes = new Dictionary<string, object?>();
        if (product.Name != request.Name.Trim()) changes["name"] = request.Name.Trim();
        if (product.Sku != sku) changes["sku"] = sku;
        if (product.Price != request.Price) changes["price"] = request.Price;
        if (delta != 0) changes["quantity"] = request.Quantity;

        product.Name = request.Name.Trim();
        product.Sku = sku;
        product.Category = NormalizeCategory(request.Category);
        product.Price = request.Price;
        product.Quantity = request.Quantity;
        product.UpdatedAt = now;

        if (delta != 0)
        {
            AddMovement(product, delta, StockMovement.Reasons.Adjustment, now);
        }

        await SaveHandlingConflictsAsync(sku, ct);
        _cache.Remove(DashboardCacheKey);
        await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.ProductUpdate, Resource(product.Id),
            new { product.Sku, changes }, ct);

        return await ToDtoAsync(product, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var product = await FindScopedAsync(id, track: true, ct);
        var imageKey = product.ImageKey;

        _db.Products.Remove(product);
        await _db.SaveChangesAsync(ct);
        _cache.Remove(DashboardCacheKey);

        if (imageKey is not null)
        {
            await _storage.DeleteAsync(TenantId, imageKey, ct);
        }

        await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.ProductDelete, Resource(id),
            new { product.Sku, product.Name }, ct);
    }

    public async Task<ProductDto> UploadImageAsync(Guid id, Stream content, string contentType, long length, CancellationToken ct)
    {
        if (length <= 0) throw new BadRequestException("The uploaded file is empty.", "INVALID_FILE");
        if (length > MaxImageBytes) throw new BadRequestException("Image must be 5 MB or smaller.", "FILE_TOO_LARGE");

        var product = await FindScopedAsync(id, track: true, ct);
        var key = await _storage.UploadAsync(TenantId, product.Id, content, contentType, ct);
        var previousKey = product.ImageKey;

        product.ImageKey = key;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (previousKey is not null)
        {
            await _storage.DeleteAsync(TenantId, previousKey, ct);
        }

        await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.ImageUpload, Resource(product.Id),
            new { key, contentType, bytes = length }, ct);
        return await ToDtoAsync(product, ct);
    }

    public async Task<ProductDto> DeleteImageAsync(Guid id, CancellationToken ct)
    {
        var product = await FindScopedAsync(id, track: true, ct);
        if (product.ImageKey is { } key)
        {
            await _storage.DeleteAsync(TenantId, key, ct);
            product.ImageKey = null;
            product.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.ImageDelete, Resource(product.Id),
                new { key }, ct);
        }

        return await ToDtoAsync(product, ct);
    }

    public async Task<ImageUrlDto> GetImageUrlAsync(Guid id, CancellationToken ct)
    {
        var product = await FindScopedAsync(id, track: false, ct);
        if (product.ImageKey is null) throw new NotFoundException("This product has no image.");

        var url = await _storage.GetPresignedUrlAsync(TenantId, product.ImageKey, ImageUrlTtl, ct);
        return new ImageUrlDto(url, DateTime.UtcNow.Add(ImageUrlTtl));
    }

    public async Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(Guid id, CancellationToken ct)
    {
        await FindScopedAsync(id, track: false, ct);

        var rows = await _db.StockMovements.AsNoTracking()
            .Where(m => m.ProductId == id)
            .OrderByDescending(m => m.Timestamp)
            .Take(200)
            .Select(m => new { Movement = m, m.Product.Name, m.Product.Sku, m.User.Email })
            .ToListAsync(ct);

        return rows.Select(r => ToMovementDto(r.Movement, r.Name, r.Sku, r.Email)).ToList();
    }

    public async Task<ProductDto> ScanAsync(Guid id, ScanRequest request, CancellationToken ct)
    {
        var product = await FindScopedAsync(id, track: true, ct);
        var resulting = product.Quantity + request.Delta;
        if (resulting < 0)
        {
            throw new BadRequestException($"Insufficient stock: only {product.Quantity} on hand.", "INSUFFICIENT_STOCK");
        }

        var now = DateTime.UtcNow;
        product.Quantity = resulting;
        product.UpdatedAt = now;
        AddMovement(product, request.Delta, request.Reason ?? StockMovement.Reasons.Scan, now);
        await _db.SaveChangesAsync(ct);
        _cache.Remove(DashboardCacheKey);

        await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.ProductScan, Resource(product.Id),
            new { request.Delta, reason = request.Reason ?? StockMovement.Reasons.Scan, resulting }, ct);
        return await ToDtoAsync(product, ct);
    }

    public async Task<IReadOnlyList<ProductDto>> ExportAsync(string format, CancellationToken ct)
    {
        var products = await _db.Products.AsNoTracking().OrderBy(p => p.Sku).ToListAsync(ct);
        await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.Export, "products",
            new { format, count = products.Count }, ct);

        // Exports never embed presigned URLs: they would outlive their 5-minute TTL in a saved file.
        return products.Select(p => ToDto(p, imageUrl: null)).ToList();
    }

    public static string ToCsv(IEnumerable<ProductDto> products)
    {
        var sb = new StringBuilder();
        sb.AppendLine("id,sku,name,category,price,quantity,created_at,updated_at");
        foreach (var p in products)
        {
            sb.Append(p.Id).Append(',')
              .Append(Csv(p.Sku)).Append(',')
              .Append(Csv(p.Name)).Append(',')
              .Append(Csv(p.Category ?? string.Empty)).Append(',')
              .Append(p.Price.ToString(CultureInfo.InvariantCulture)).Append(',')
              .Append(p.Quantity).Append(',')
              .Append(p.CreatedAt.ToString("O", CultureInfo.InvariantCulture)).Append(',')
              .Append(p.UpdatedAt.ToString("O", CultureInfo.InvariantCulture))
              .AppendLine();
        }

        return sb.ToString();
    }

    public static StockMovementDto ToMovementDto(StockMovement m, string productName, string sku, string? actorEmail) =>
        new(m.Id, m.ProductId, productName, sku, StockMovementDto.TypeFor(m.Delta, m.Reason), m.Delta, m.Reason,
            actorEmail, m.Timestamp, m.Delta, m.Reason, m.ResultingQuantity);

    /// <summary>
    /// Loads a product through the tenant filter. A miss is indistinguishable from a cross-tenant ID
    /// (both return 404, avoiding enumeration) and is recorded as a possible cross-tenant probe.
    /// </summary>
    private async Task<Product> FindScopedAsync(Guid id, bool track, CancellationToken ct)
    {
        var source = track ? _db.Products : _db.Products.AsNoTracking();
        var product = await source.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is not null) return product;

        await _audit.LogAsync(TenantId, _currentUser.UserId, AuditEntry.Actions.CrossTenantAttempt, Resource(id),
            new
            {
                method = _currentUser.RequestMethod,
                path = _currentUser.RequestPath,
                status = 404,
                reason = "Product not found in the current tenant scope",
                targetTenant = (string?)null,
            }, ct);
        throw new NotFoundException("Product not found");
    }

    private void AddMovement(Product product, int delta, string reason, DateTime timestamp)
    {
        _db.StockMovements.Add(new StockMovement
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            Delta = delta,
            Reason = reason,
            UserId = _currentUser.RequireUserId(),
            Timestamp = timestamp,
            ResultingQuantity = product.Quantity,
        });
    }

    private async Task SaveHandlingConflictsAsync(string sku, CancellationToken ct)
    {
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new ConflictException($"A product with SKU '{sku}' already exists in this tenant.");
        }
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true;

    private async Task<ProductDto> ToDtoAsync(Product product, CancellationToken ct)
    {
        var imageUrl = product.ImageKey is null
            ? null
            : await _storage.GetPresignedUrlAsync(product.TenantId, product.ImageKey, ImageUrlTtl, ct);
        return ToDto(product, imageUrl);
    }

    private ProductDto ToDto(Product p, string? imageUrl) =>
        new(p.Id, p.TenantId, p.Sku, p.Name, p.Category, p.Price, p.Quantity, imageUrl,
            _options.LowStockThreshold, p.CreatedAt, p.UpdatedAt);

    private static string? NormalizeCategory(string? category) =>
        string.IsNullOrWhiteSpace(category) ? null : category.Trim();

    private static string Resource(Guid productId) => $"product:{productId}";

    private static string Csv(string value)
    {
        // Neutralize spreadsheet formula injection, then quote.
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0])) value = "'" + value;
        return $"\"{value.Replace("\"", "\"\"")}\"";
    }
}
