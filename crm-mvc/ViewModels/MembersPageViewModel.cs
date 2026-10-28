namespace Vitaloop.Crm.Web.ViewModels;

public sealed class MembersPageViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public string Search { get; init; } = string.Empty;
    public IReadOnlyList<MemberViewModel> Members { get; init; } = Array.Empty<MemberViewModel>();
    public int TotalMembers => Members.Count;
    public int PractitionerCount => Members.Count(x => string.Equals(x.OrgRole, "practitioner", StringComparison.OrdinalIgnoreCase));
}
