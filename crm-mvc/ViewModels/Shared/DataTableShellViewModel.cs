namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class DataTableShellViewModel
{
    public required string Title { get; init; }
    public required IReadOnlyList<string> Columns { get; init; }
    public string EmptyMessage { get; init; } = "No records yet.";
    public IReadOnlyList<IReadOnlyList<string>> Rows { get; init; } = Array.Empty<IReadOnlyList<string>>();
}
