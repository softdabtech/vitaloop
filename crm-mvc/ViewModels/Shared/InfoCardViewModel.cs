namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class InfoCardViewModel
{
    public required string Title { get; init; }
    public required string Body { get; init; }
    public string Tone { get; init; } = "default";
}
