using System.Diagnostics;
using FluentValidation;
using TenantVault.Application.Exceptions;
using TenantVault.Domain.Exceptions;

namespace TenantVault.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client went away; there is nobody to respond to.
        }
        catch (Exception ex) when (!context.Response.HasStarted)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception exception)
    {
        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;
        int status;
        object body;

        switch (exception)
        {
            case TenantMismatchException mismatch:
                _logger.LogWarning(mismatch, "Blocked cross-tenant data access");
                status = StatusCodes.Status403Forbidden;
                body = new { error = mismatch.Message, code = "TENANT_MISMATCH", traceId };
                break;

            case ValidationException validation:
                status = StatusCodes.Status400BadRequest;
                body = new
                {
                    error = "Validation failed",
                    code = "VALIDATION_FAILED",
                    errors = validation.Errors
                        .GroupBy(e => ToCamelCase(e.PropertyName))
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray()),
                    traceId,
                };
                break;

            case AppException app:
                status = app.StatusCode;
                body = new { error = app.Message, code = app.Code, traceId };
                break;

            default:
                _logger.LogError(exception, "Unhandled exception");
                status = StatusCodes.Status500InternalServerError;
                body = new
                {
                    error = "An unexpected error occurred.",
                    code = "INTERNAL_ERROR",
                    traceId,
                    detail = _environment.IsDevelopment() ? exception.Message : null,
                };
                break;
        }

        context.Response.Clear();
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(body);
    }

    private static string ToCamelCase(string name) =>
        string.IsNullOrEmpty(name) ? name : char.ToLowerInvariant(name[0]) + name[1..];
}
