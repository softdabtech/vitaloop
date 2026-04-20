namespace Vitaloop.Crm.Web.ViewModels;

public sealed class AdminDashboardViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public int TotalMembers { get; init; }
    public int PendingInvites { get; init; }
    public int ActiveAssignments { get; init; }
}
