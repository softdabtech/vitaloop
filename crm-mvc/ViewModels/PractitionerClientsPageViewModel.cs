namespace Vitaloop.Crm.Web.ViewModels;

public sealed class PractitionerClientsPageViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public IReadOnlyList<AssignmentViewModel> Clients { get; init; } = Array.Empty<AssignmentViewModel>();
}

public sealed class PractitionerClientProfileViewModel
{
    public Guid ActiveOrganizationId { get; init; }
    public AssignmentViewModel? Assignment { get; init; }
    public ClinicalSummaryViewModel? ClinicalSummary { get; init; }
}

/// <summary>
/// P8 Practitioner Mode: server-rendered shape of GET
/// /admin/clients/{clientId}/clinical-summary (see
/// backend/app/routers/crm/crm.py::get_client_clinical_summary), parsed
/// from its raw JsonDocument in ClientsController.Profile so the Razor
/// view works with plain properties instead of JsonElement navigation.
/// </summary>
public sealed class ClinicalSummaryViewModel
{
    public bool Available { get; init; }
    public string? Reason { get; init; }
    public string? UploadId { get; init; }
    public DateTimeOffset? GeneratedAt { get; init; }
    public IReadOnlyList<ClinicalPatternViewModel> TopPatterns { get; init; } = Array.Empty<ClinicalPatternViewModel>();
    public IReadOnlyList<ClinicalPatternViewModel> RedFlags { get; init; } = Array.Empty<ClinicalPatternViewModel>();
    public int EvidenceGapCount { get; init; }
    public int HighPriorityGapCount { get; init; }
    public IReadOnlyList<string> NextBestTests { get; init; } = Array.Empty<string>();
    public bool ProgressAvailable { get; init; }
    public IReadOnlyList<ProgressChangeViewModel> ProgressChanges { get; init; } = Array.Empty<ProgressChangeViewModel>();
    public bool RequiresDoctorDiscussion { get; init; }
    public ActionPlanByRoleViewModel? ActionPlan { get; init; }
}

/// <summary>P9 follow-up: the same self/practitioner/doctor/urgent buckets
/// the b2c report shows the client, passed through for the practitioner —
/// see backend/app/services/action_plan_by_role.py.</summary>
public sealed class ActionPlanByRoleViewModel
{
    public IReadOnlyList<ActionPlanItemViewModel> Urgent { get; init; } = Array.Empty<ActionPlanItemViewModel>();
    public IReadOnlyList<ActionPlanItemViewModel> Doctor { get; init; } = Array.Empty<ActionPlanItemViewModel>();
    public IReadOnlyList<ActionPlanItemViewModel> Practitioner { get; init; } = Array.Empty<ActionPlanItemViewModel>();
    public IReadOnlyList<ActionPlanItemViewModel> Self { get; init; } = Array.Empty<ActionPlanItemViewModel>();
}

public sealed class ActionPlanItemViewModel
{
    public string Title { get; init; } = "";
    public string? Reason { get; init; }
}

public sealed class ClinicalPatternViewModel
{
    public string PatternId { get; init; } = "";
    public string PatternName { get; init; } = "";
    public string Domain { get; init; } = "";
    public double? Confidence { get; init; }
    public string? Severity { get; init; }
    public bool DoctorFlag { get; init; }
    public string? SafetyLevel { get; init; }
    public string? Summary { get; init; }
    public string? PractitionerExplanation { get; init; }
}

public sealed class ProgressChangeViewModel
{
    public string PatternName { get; init; } = "";
    public string Status { get; init; } = "";
}
