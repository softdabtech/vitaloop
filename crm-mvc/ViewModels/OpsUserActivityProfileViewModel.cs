namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OpsUserActivityProfileViewModel
{
    public MemberViewModel User { get; init; } = new();
    public int Days { get; init; } = 90;
    public string ActivityJson { get; init; } = "{}";
    public string? ActivityError { get; init; }
}
