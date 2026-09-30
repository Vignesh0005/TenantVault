namespace TenantVault.Application.Exceptions;

/// <summary>Base for exceptions that map to a specific HTTP status with an explainable body.</summary>
public abstract class AppException : Exception
{
    protected AppException(string message, string code, int statusCode)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }

    public string Code { get; }
    public int StatusCode { get; }
}

public sealed class NotFoundException : AppException
{
    public NotFoundException(string message)
        : base(message, "NOT_FOUND", 404)
    {
    }
}

public sealed class ConflictException : AppException
{
    public ConflictException(string message)
        : base(message, "CONFLICT", 409)
    {
    }
}

public sealed class BadRequestException : AppException
{
    public BadRequestException(string message, string code = "BAD_REQUEST")
        : base(message, code, 400)
    {
    }
}

public sealed class UnauthorizedException : AppException
{
    public UnauthorizedException(string message, string code = "UNAUTHORIZED")
        : base(message, code, 401)
    {
    }
}

public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string message, string code = "FORBIDDEN")
        : base(message, code, 403)
    {
    }
}
