namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class StatusPillViewModel
{
    public required string Text { get; init; }
    public string Tone { get; init; } = "default";
}
