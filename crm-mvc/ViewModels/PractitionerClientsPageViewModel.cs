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

    /// <summary>P18b: practitioner-facing Clinical Reasoning Map — top
    /// hypotheses (P14, calibrated by P16) cross-referenced with P15
    /// contradictions, P21 outcome-attribution confounders, and P22
    /// evidence debt, capped to 3 cards. Presentation-only reshape of
    /// backend/app/routers/crm/crm.py::get_client_clinical_summary's
    /// pass-through fields — no new clinical logic.</summary>
    public IReadOnlyList<ReasoningMapCardViewModel> ReasoningMap { get; init; } = Array.Empty<ReasoningMapCardViewModel>();
    public EvidenceDebtSummaryViewModel? EvidenceDebt { get; init; }
    public ReportQualityAuditSummaryViewModel? ReportQualityAudit { get; init; }

    /// <summary>P30: which population profile(s) (P24.3) were selected for
    /// this report, and why — see backend/app/services/
    /// population_profile_selection.py. Null when the report predates
    /// P24.3 (no profile-selection field in its frozen input_snapshot).</summary>
    public PopulationProfileSelectionViewModel? PopulationProfileSelection { get; init; }

    /// <summary>P30: per-profile priority-adjustment overlays (P24) — see
    /// backend/app/services/population_profiles.py. Null/empty when the
    /// report predates P24.</summary>
    public PopulationProfileOverlaysViewModel? PopulationProfileOverlays { get; init; }

    /// <summary>P30: structured doctor/urgent escalation explanations
    /// (P25) — see backend/app/services/doctor_escalation_precision.py.
    /// Unlike the b2c-facing P29 UI, the practitioner audience is allowed
    /// to see reason_codes/related_hypotheses/related_contradictions.
    /// Null when the report predates P25.</summary>
    public DoctorEscalationPrecisionViewModel? DoctorEscalationPrecision { get; init; }
}

public sealed class PopulationProfileSelectionViewModel
{
    public IReadOnlyList<string> ActiveProfileIds { get; init; } = Array.Empty<string>();
    public string? SelectionSource { get; init; }
    public IReadOnlyList<string> SelectionReasons { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> IgnoredProfileIds { get; init; } = Array.Empty<string>();
}

public sealed class PopulationProfileOverlaysViewModel
{
    public IReadOnlyList<ProfileOverlayViewModel> Profiles { get; init; } = Array.Empty<ProfileOverlayViewModel>();
}

public sealed class ProfileOverlayViewModel
{
    public string ProfileId { get; init; } = "";
    public string Label { get; init; } = "";
    public IReadOnlyList<PriorityAdjustmentViewModel> PriorityAdjustments { get; init; } = Array.Empty<PriorityAdjustmentViewModel>();
    public IReadOnlyList<NextTestEmphasisViewModel> NextTestEmphasis { get; init; } = Array.Empty<NextTestEmphasisViewModel>();
    public IReadOnlyList<string> PractitionerPrompts { get; init; } = Array.Empty<string>();
}

public sealed class PriorityAdjustmentViewModel
{
    public string Domain { get; init; } = "";
    public string? Label { get; init; }
    public string? CalibratedConfidence { get; init; }
    public string ProfileEmphasis { get; init; } = "standard";
    public string? Reason { get; init; }
}

public sealed class NextTestEmphasisViewModel
{
    public string Domain { get; init; } = "";
    public string? Marker { get; init; }
    public string? Priority { get; init; }
    public bool AlreadyBeingAddressed { get; init; }
    public string? Reason { get; init; }
}

public sealed class DoctorEscalationPrecisionViewModel
{
    public string? OverallLevel { get; init; }
    public string? RecommendedTiming { get; init; }
    public IReadOnlyList<DoctorEscalationItemViewModel> Escalations { get; init; } = Array.Empty<DoctorEscalationItemViewModel>();
}

public sealed class DoctorEscalationItemViewModel
{
    public string? Id { get; init; }
    public string Level { get; init; } = "";
    public string? RecommendedTiming { get; init; }
    public string Domain { get; init; } = "";
    public IReadOnlyList<string> ReasonCodes { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> RelatedMarkers { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> RelatedSymptoms { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> RelatedHypotheses { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> RelatedContradictions { get; init; } = Array.Empty<string>();
    public string? HumanReadableReason { get; init; }
}

public sealed class ReasoningMapCardViewModel
{
    public string Domain { get; init; } = "";
    public string Label { get; init; } = "";
    public string? CalibratedConfidence { get; init; }
    public double? CalibratedScore { get; init; }
    public string? DebtLevel { get; init; }
    public IReadOnlyList<string> SupportingEvidence { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Limitations { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> NextTests { get; init; } = Array.Empty<string>();
    public string ActionBucket { get; init; } = "self";
}

public sealed class EvidenceDebtSummaryViewModel
{
    public string? OverallDebt { get; init; }
    public double? OverallScore { get; init; }
}

public sealed class ReportQualityAuditSummaryViewModel
{
    public string? AuditStatus { get; init; }
    public int MarkersReviewed { get; init; }
    public int DomainsAssessed { get; init; }
    public int HighConfidenceItems { get; init; }
    public int BlockedOrLowConfidenceItems { get; init; }
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
