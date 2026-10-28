namespace Vitaloop.Crm.Web.ViewModels.Shared;

public sealed class StatCardViewModel
{
    public required string Label { get; init; }
    public required string Value { get; init; }
    public string? Trend { get; init; }
    public string Tone { get; init; } = "default";
}
