namespace Vitaloop.Crm.Web.ViewModels;

public sealed class PractitionerClientsPageViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public IReadOnlyList<AssignmentViewModel> Clients { get; init; } = Array.Empty<AssignmentViewModel>();
}

public sealed class PractitionerClientProfileViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public AssignmentViewModel? Assignment { get; init; }
}
