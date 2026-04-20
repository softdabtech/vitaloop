namespace Vitaloop.Crm.Web.ViewModels;

public sealed class AssignmentsPageViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public IReadOnlyList<AssignmentViewModel> Assignments { get; init; } = Array.Empty<AssignmentViewModel>();
    public IReadOnlyList<MemberViewModel> PractitionerOptions { get; init; } = Array.Empty<MemberViewModel>();
}
