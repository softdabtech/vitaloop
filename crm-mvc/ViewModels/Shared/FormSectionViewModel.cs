namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class FormSectionViewModel
{
    public required string Title { get; init; }
    public string Description { get; init; } = string.Empty;
}
