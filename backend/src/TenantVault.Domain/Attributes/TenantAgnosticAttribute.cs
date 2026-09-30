namespace TenantVault.Domain.Attributes;

/// <summary>
/// Explicitly exempts an entity that has a <c>TenantId</c> property from tenant filtering.
/// The startup assertion refuses to boot if such an entity lacks both this attribute and <see cref="Interfaces.ITenantEntity"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class TenantAgnosticAttribute : Attribute
{
    public TenantAgnosticAttribute(string justification)
    {
        Justification = justification;
    }

    public string Justification { get; }
}
