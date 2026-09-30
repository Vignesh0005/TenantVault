using Microsoft.AspNetCore.Mvc;
using TenantVault.Api.Filters;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.Services;
using TenantVault.Domain.Entities;

namespace TenantVault.Api.Controllers;

[Route("products")]
[TenantRequired]
public sealed class ProductsController : TenantControllerBase
{
    // Multipart framing overhead on top of the 5 MB image limit enforced by the service.
    private const long MaxUploadRequestBytes = ProductService.MaxImageBytes + 64 * 1024;

    private readonly ProductService _products;

    public ProductsController(ProductService products)
    {
        _products = products;
    }

    [HttpGet]
    public Task<PagedResult<ProductDto>> List(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default) =>
        _products.ListAsync(new ProductQuery(search, category, page, pageSize), ct);

    [HttpGet("categories")]
    public Task<IReadOnlyList<string>> Categories(CancellationToken ct) => _products.GetCategoriesAsync(ct);

    /// <summary>Returns 404 for products that belong to another tenant, so ids cannot be enumerated.</summary>
    [HttpGet("{id:guid}")]
    public Task<ProductDto> Get(Guid id, CancellationToken ct) => _products.GetAsync(id, ct);

    [HttpPost]
    [RequireRole(Role.Admin, Role.Staff)]
    [ProducesResponseType<ProductDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest request, CancellationToken ct)
    {
        var product = await _products.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = product.Id }, product);
    }

    [HttpPut("{id:guid}")]
    [RequireRole(Role.Admin, Role.Staff)]
    public Task<ProductDto> Update(Guid id, UpdateProductRequest request, CancellationToken ct) =>
        _products.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [RequireRole(Role.Admin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _products.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Multipart upload (field <c>file</c>). PNG, JPEG or WebP, max 5 MB. The storage key is generated server-side.</summary>
    [HttpPost("{id:guid}/image")]
    [RequireRole(Role.Admin, Role.Staff)]
    [RequestSizeLimit(MaxUploadRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadRequestBytes)]
    [Consumes("multipart/form-data")]
    public async Task<ProductDto> UploadImage(Guid id, IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return await _products.UploadImageAsync(id, stream, file.ContentType, file.Length, ct);
    }

    [HttpDelete("{id:guid}/image")]
    [RequireRole(Role.Admin, Role.Staff)]
    public Task<ProductDto> DeleteImage(Guid id, CancellationToken ct) => _products.DeleteImageAsync(id, ct);

    /// <summary>A presigned GET URL valid for 5 minutes.</summary>
    [HttpGet("{id:guid}/image-url")]
    public Task<ImageUrlDto> ImageUrl(Guid id, CancellationToken ct) => _products.GetImageUrlAsync(id, ct);

    [HttpGet("{id:guid}/movements")]
    public Task<IReadOnlyList<StockMovementDto>> Movements(Guid id, CancellationToken ct) => _products.GetMovementsAsync(id, ct);

    [HttpPost("{id:guid}/scan")]
    [RequireRole(Role.Admin, Role.Staff)]
    public Task<ProductDto> Scan(Guid id, ScanRequest request, CancellationToken ct) => _products.ScanAsync(id, request, ct);
}
