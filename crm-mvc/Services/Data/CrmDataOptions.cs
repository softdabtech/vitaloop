namespace Vitaloop.Crm.Web.Services.Data;

public sealed class CrmDataOptions
{
    public const string SectionName = "CrmData";

    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>HTTP request timeout in seconds. Defaults to 30.</summary>
    public int TimeoutSeconds { get; set; } = 30;

    public string OrganizationsPath { get; set; } = "/api/admin/organizations";
    public string OrganizationSettingsPath { get; set; } = "/api/admin/organizations/{orgId}/settings";
    public string MembersPath { get; set; } = "/api/admin/members";
    public string InvitationsPath { get; set; } = "/api/admin/invitations";
    public string AssignmentsPath { get; set; } = "/api/admin/assignments";
    public string GlobalUsersPath { get; set; } = "/api/admin/users";
    public string UserContextPath { get; set; } = "/auth/me";
    public string UserContextFallbackPath { get; set; } = "/profile";
}

