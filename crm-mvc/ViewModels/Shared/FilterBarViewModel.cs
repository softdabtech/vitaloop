namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class FilterBarViewModel
{
    public string SearchPlaceholder { get; init; } = "Search...";
    public IReadOnlyList<string> Filters { get; init; } = Array.Empty<string>();
}
