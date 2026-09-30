namespace TenantVault.Domain.Exceptions;

/// <summary>
/// Thrown when code attempts to read or write data that belongs to a tenant other than the
/// one bound to the current request. Surfaced to clients as an explainable 403.
/// </summary>
public sealed class TenantMismatchException : Exception
{
    public TenantMismatchException(string message)
        : base(message)
    {
    }

    public TenantMismatchException(Guid? expectedTenantId, Guid actualTenantId, string entityName)
        : base($"Cross-tenant write blocked: {entityName} belongs to tenant {actualTenantId}, but the request is scoped to {expectedTenantId?.ToString() ?? "no tenant"}.")
    {
        ExpectedTenantId = expectedTenantId;
        ActualTenantId = actualTenantId;
    }

    public Guid? ExpectedTenantId { get; }
    public Guid? ActualTenantId { get; }
}
