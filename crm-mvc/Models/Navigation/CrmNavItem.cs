namespace Vitaloop.Crm.Web.Models.Navigation;

/// <summary>
/// One entry in the CRM's left sidebar.
///
/// 2026-09-13 CRM information-architecture audit, item #4 (sidebar was a
/// static list hardcoded directly inside Views/Shared/Partials/_Sidebar.cshtml,
/// with role-visibility logic re-implemented inline in Razor): every new area
/// added since (most recently Ops/KnowledgeRulesController) had to remember
/// to also go add a line to that partial by hand, with no compiler help if
/// forgotten — exactly what happened with the Knowledge Rules page, which
/// shipped with zero discoverable navigation path for weeks. Moving the data
/// AND the visibility rule into CrmNavigationCatalog (a plain C# class) makes
/// the full nav list something a reviewer can read/test in one file, and
/// something a future page's PR is expected to touch, rather than a fact
/// buried inside a Razor view.
/// </summary>
public sealed record CrmNavItem(
    string Href,
    string Label,
    string Group,
    string IconHtmlEntity,
    IReadOnlyList<string> RequireRoles);
