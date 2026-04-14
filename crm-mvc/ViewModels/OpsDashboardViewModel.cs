namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OpsDashboardViewModel
{
    public IReadOnlyList<MemberViewModel> GlobalUsers { get; init; } = Array.Empty<MemberViewModel>();
}
