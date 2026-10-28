using Vitaloop.Crm.Web.Models.Crm;

namespace Vitaloop.Crm.Web.ViewModels;

public sealed class OpsKnowledgeRulesPageViewModel
{
    public IReadOnlyList<KnowledgeRuleListItem> Rules { get; init; } = Array.Empty<KnowledgeRuleListItem>();
    public string? GovernanceStatus { get; init; }
    public string? Key { get; init; }
    public string? ErrorMessage { get; init; }
}
