namespace Vitaloop.Crm.Web.ViewModels;

public sealed class CreateAssignmentViewModel
{
    public Guid OrganizationId { get; set; }
    public Guid PractitionerId { get; set; }
    public Guid ClientId { get; set; }
    public string? Notes { get; set; }
}
