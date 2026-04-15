namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OrganizationsPageViewModel
{
    public IReadOnlyList<OrganizationViewModel> Organizations { get; init; } = Array.Empty<OrganizationViewModel>();
    public int TotalOrganizations => Organizations.Count;
    public bool IsSuperAdmin { get; init; }
    public string? CreateOrgUrl { get; init; }
}

public sealed class OrganizationDetailViewModel
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? LogoUrl { get; init; }
    public string OwnerName { get; init; } = string.Empty;
    public int MemberCount { get; init; }
    public int PractitionerCount { get; init; }
    public IReadOnlyList<MemberViewModel> Members { get; init; } = Array.Empty<MemberViewModel>();
}

public sealed class CreateOrganizationViewModel
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string OwnerEmail { get; set; } = string.Empty;
}
