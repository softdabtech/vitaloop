namespace Vitaloop.Crm.Web.Models.Crm;

public sealed class KnowledgeRuleListItem
{
    public string Id { get; init; } = string.Empty;
    public string Key { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public IReadOnlyList<string> InputEntities { get; init; } = Array.Empty<string>();
    public double Confidence { get; init; }
    public string? Severity { get; init; }
    public bool RequiresDoctor { get; init; }
    public string? Source { get; init; }
    public string? SourceUrl { get; init; }
    public string? Version { get; init; }
    public bool Active { get; init; }
    public string GovernanceStatus { get; init; } = string.Empty;
    public string? LastModifiedBy { get; init; }
    public string? MedicalReviewedBy { get; init; }
    public DateTimeOffset? MedicalReviewedAt { get; init; }
    public string? ChangeNote { get; init; }
    public DateTimeOffset? CreatedAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
}

public sealed class KnowledgeRuleDetail
{
    public string Id { get; init; } = string.Empty;
    public string Key { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public IReadOnlyList<string> InputEntities { get; init; } = Array.Empty<string>();
    public object? Conditions { get; init; }
    public object? Outputs { get; init; }
    public double Confidence { get; init; }
    public string? Severity { get; init; }
    public bool RequiresDoctor { get; init; }
    public string ExplanationTemplate { get; init; } = string.Empty;
    public string? Source { get; init; }
    public string? SourceUrl { get; init; }
    public string GovernanceStatus { get; init; } = string.Empty;
    public string? LastModifiedBy { get; init; }
    public string? MedicalReviewedBy { get; init; }
    public DateTimeOffset? MedicalReviewedAt { get; init; }
}

/// <summary>
/// Payload for POST /knowledge/rules/{id}/approve — see
/// backend/app/schemas/knowledge.py::KnowledgeRuleApproveRequest. Approving a
/// rule is a real clinical sign-off: medical_reviewed_by/medical_reviewed_at
/// record who actually reviewed the rule's content and when, not just who
/// clicked the button in the abstract.
/// </summary>
public sealed class KnowledgeRuleApprovePayload
{
    public string MedicalReviewedBy { get; init; } = string.Empty;
    public DateTimeOffset MedicalReviewedAt { get; init; }
    public string? LastModifiedBy { get; init; }
    public string ChangeNote { get; init; } = string.Empty;
}
