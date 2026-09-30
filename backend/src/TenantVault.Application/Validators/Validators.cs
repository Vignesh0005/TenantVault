using FluentValidation;
using TenantVault.Application.DTOs.Auth;
using TenantVault.Application.DTOs.Insights;
using TenantVault.Application.DTOs.Products;
using TenantVault.Application.DTOs.Tenants;
using TenantVault.Domain.Entities;

namespace TenantVault.Application.Validators;

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6).MaximumLength(128);
    }
}

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(128)
            .Matches(@"\d").WithMessage("Password must contain at least one digit.");
    }
}

internal static class ProductRules
{
    public const string SkuPattern = "^[A-Z0-9-]+$";

    public static void Apply<T>(AbstractValidator<T> validator,
        System.Linq.Expressions.Expression<Func<T, string>> name,
        System.Linq.Expressions.Expression<Func<T, string>> sku,
        System.Linq.Expressions.Expression<Func<T, string?>> category,
        System.Linq.Expressions.Expression<Func<T, decimal>> price,
        System.Linq.Expressions.Expression<Func<T, int>> quantity)
    {
        validator.RuleFor(name).NotEmpty().Length(2, 100);
        validator.RuleFor(sku).NotEmpty().Length(2, 50)
            .Matches(SkuPattern).WithMessage("SKU may only contain uppercase letters, digits and dashes.");
        validator.RuleFor(category).MaximumLength(50);
        validator.RuleFor(price).GreaterThanOrEqualTo(0).LessThan(100_000_000);
        validator.RuleFor(quantity).GreaterThanOrEqualTo(0);
    }
}

public sealed class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductRequestValidator()
    {
        ProductRules.Apply(this, x => x.Name, x => x.Sku, x => x.Category, x => x.Price, x => x.Quantity);
    }
}

public sealed class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator()
    {
        ProductRules.Apply(this, x => x.Name, x => x.Sku, x => x.Category, x => x.Price, x => x.Quantity);
    }
}

public sealed class ScanRequestValidator : AbstractValidator<ScanRequest>
{
    public ScanRequestValidator()
    {
        RuleFor(x => x.Delta).NotEqual(0).InclusiveBetween(-10_000, 10_000);
        RuleFor(x => x.Reason)
            .Must(r => r is null || StockMovement.Reasons.All.Contains(r))
            .WithMessage($"Reason must be one of: {string.Join(", ", StockMovement.Reasons.All)}.");
    }
}

public sealed class CreateTenantRequestValidator : AbstractValidator<CreateTenantRequest>
{
    public CreateTenantRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Length(2, 100);
    }
}

public sealed class AssistantRequestValidator : AbstractValidator<AssistantRequest>
{
    public AssistantRequestValidator()
    {
        RuleFor(x => x.Message).NotEmpty().MaximumLength(500);
    }
}
