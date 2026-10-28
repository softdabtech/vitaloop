namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class ModalShellViewModel
{
    public required string Id { get; init; }
    public required string Title { get; init; }
    public string Description { get; init; } = string.Empty;
}
