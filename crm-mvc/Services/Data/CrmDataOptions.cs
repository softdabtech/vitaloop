namespace Vitaloop.Crm.Web.Services.Data;

public sealed class CrmDataOptions
{
    public const string SectionName = "CrmData";

    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>HTTP request timeout in seconds. Defaults to 30.</summary>
    public int TimeoutSeconds { get; set; } = 30;

    public string OrganizationsPath { get; set; } = "/admin/organizations";
    public string OrganizationSettingsPath { get; set; } = "/admin/organizations/{orgId}/settings";
    public string MembersPath { get; set; } = "/admin/members";
    public string InvitationsPath { get; set; } = "/admin/invitations";
    public string AssignmentsPath { get; set; } = "/admin/assignments";
    public string GlobalUsersPath { get; set; } = "/admin/users";
    public string UserContextPath { get; set; } = "/auth/me";
    public string UserContextFallbackPath { get; set; } = "/profile";
}

