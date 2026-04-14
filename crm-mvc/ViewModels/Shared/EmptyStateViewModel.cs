namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class EmptyStateViewModel
{
    public required string Title { get; init; }
    public required string Description { get; init; }
    public string? ActionLabel { get; init; }
    public string? ActionHref { get; init; }
}
