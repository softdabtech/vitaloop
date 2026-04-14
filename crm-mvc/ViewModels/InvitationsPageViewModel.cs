namespace Vitaloop.Crm.Web.ViewModels;

public sealed class InvitationsPageViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public string Search { get; init; } = string.Empty;
    public IReadOnlyList<InvitationViewModel> Invitations { get; init; } = Array.Empty<InvitationViewModel>();
}
