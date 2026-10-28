namespace Vitaloop.Crm.Web.ViewModels;

public sealed class SettingsPageViewModel
{
    public string DisplayName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string TimeZone { get; init; } = "UTC";
    public string Language { get; init; } = "en";
    public bool CompactMode { get; init; }
    public bool EmailDigestEnabled { get; init; } = true;
    public bool SecurityAlertsEnabled { get; init; } = true;
}
