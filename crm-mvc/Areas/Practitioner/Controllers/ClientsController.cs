using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Practitioner.Controllers;

[Area("Practitioner")]
[Route("practitioner/clients")]
[RequireOrgRole("practitioner", "org_owner", "client_admin", "manager")]
public class ClientsController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IActiveOrganizationResolver _activeOrganizationResolver;
    private readonly AssignmentService _assignmentService;
    private readonly IAccessPolicyService _accessPolicyService;
    private readonly OrganizationService _organizationService;
    private readonly ICrmDataGateway _crmDataGateway;
    private readonly ILogger<ClientsController> _logger;

    public ClientsController(
        IUserContextAccessor userContextAccessor,
        IActiveOrganizationResolver activeOrganizationResolver,
        AssignmentService assignmentService,
        IAccessPolicyService accessPolicyService,
        OrganizationService organizationService,
        ICrmDataGateway crmDataGateway,
        ILogger<ClientsController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _activeOrganizationResolver = activeOrganizationResolver;
        _assignmentService = assignmentService;
        _accessPolicyService = accessPolicyService;
        _organizationService = organizationService;
        _crmDataGateway = crmDataGateway;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);
        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return Redirect("/auth/post-login");
        }

        try
        {
            var orgId = userCtx.ActiveOrganizationId.Value;
            var assignments = await _assignmentService.GetAssignments(userCtx, orgId, ct);

            var canSeeAll = _accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin", "manager")
                || _accessPolicyService.HasGlobalRole(userCtx, "super_admin");

            var visible = canSeeAll
                ? assignments
                : assignments.Where(a => a.PractitionerId == userCtx.UserId).ToList();

            var model = new PractitionerClientsPageViewModel
            {
                ActiveOrganizationId = orgId,
                Clients = visible.Select(a => new AssignmentViewModel
                {
                    Id = a.Id,
                    OrganizationId = a.OrganizationId ?? Guid.Empty,
                    ClientId = a.ClientId ?? Guid.Empty,
                    ClientName = a.ClientName,
                    PractitionerId = a.PractitionerId ?? Guid.Empty,
                    PractitionerName = a.PractitionerName,
                    Status = a.Status,
                    Notes = a.Notes,
                    UpdatedAt = a.UpdatedAt,
                }).ToList()
            };

            return View(model);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load practitioner clients.");
            TempData["ErrorMessage"] = "Could not load client list.";
            return View(new PractitionerClientsPageViewModel());
        }
    }

    [HttpGet("{assignmentId:guid}")]
    public async Task<IActionResult> Profile(Guid assignmentId, CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);
        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return RedirectToAction(nameof(Index));
        }

        var orgId = userCtx.ActiveOrganizationId.Value;
        var assignments = await _assignmentService.GetAssignments(userCtx, orgId, ct);
        var canSeeAll = _accessPolicyService.HasOrgRole(userCtx, orgId, "org_owner", "client_admin", "manager")
            || _accessPolicyService.HasGlobalRole(userCtx, "super_admin");

        var selected = assignments.FirstOrDefault(a => a.Id == assignmentId);
        if (selected is null || (!canSeeAll && selected.PractitionerId != userCtx.UserId))
        {
            TempData["ErrorMessage"] = "Client assignment not found or access denied.";
            return RedirectToAction(nameof(Index));
        }

        ClinicalSummaryViewModel? clinicalSummary = null;
        if (selected.ClientId.HasValue)
        {
            try
            {
                var doc = await _crmDataGateway.GetClientClinicalSummary(orgId, selected.ClientId.Value, ct);
                clinicalSummary = ParseClinicalSummary(doc);
            }
            catch (Exception ex)
            {
                // Fail-open, matching the same posture the backend endpoint
                // itself uses for its own history lookups: a practitioner
                // should still see the client's profile/assignment details
                // even if the clinical-summary call fails.
                _logger.LogWarning(ex, "Failed to load clinical summary for client {ClientId}", selected.ClientId);
            }
        }

        return View(new PractitionerClientProfileViewModel
        {
            ActiveOrganizationId = orgId,
            Assignment = new AssignmentViewModel
            {
                Id = selected.Id,
                OrganizationId = selected.OrganizationId ?? Guid.Empty,
                ClientId = selected.ClientId ?? Guid.Empty,
                ClientName = selected.ClientName,
                PractitionerId = selected.PractitionerId ?? Guid.Empty,
                PractitionerName = selected.PractitionerName,
                Status = selected.Status,
                Notes = selected.Notes,
                UpdatedAt = selected.UpdatedAt,
            },
            ClinicalSummary = clinicalSummary,
        });
    }

    private static ClinicalSummaryViewModel? ParseClinicalSummary(JsonDocument? doc)
    {
        if (doc is null) return null;
        var root = doc.RootElement;
        var available = root.TryGetProperty("available", out var availableEl) && availableEl.GetBoolean();
        if (!available)
        {
            return new ClinicalSummaryViewModel
            {
                Available = false,
                Reason = root.TryGetProperty("reason", out var reasonEl) ? reasonEl.GetString() : null,
            };
        }

        var progress = root.TryGetProperty("progress_since_last", out var progressEl) ? progressEl : default;
        var progressAvailable = progress.ValueKind == JsonValueKind.Object
            && progress.TryGetProperty("available", out var progAvailEl) && progAvailEl.GetBoolean();
        var progressChanges = new List<ProgressChangeViewModel>();
        if (progressAvailable && progress.TryGetProperty("changes", out var changesEl) && changesEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var change in changesEl.EnumerateArray())
            {
                progressChanges.Add(new ProgressChangeViewModel
                {
                    PatternName = change.TryGetProperty("pattern_name", out var pn) ? pn.GetString() ?? "" : "",
                    Status = change.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "",
                });
            }
        }

        var evidenceGaps = root.TryGetProperty("evidence_gaps_summary", out var gapsEl) ? gapsEl : default;
        var nextTests = new List<string>();
        if (root.TryGetProperty("next_best_tests", out var testsEl) && testsEl.ValueKind == JsonValueKind.Array)
        {
            foreach (var test in testsEl.EnumerateArray())
            {
                var marker = test.TryGetProperty("marker", out var m) ? m.GetString() : null;
                if (!string.IsNullOrWhiteSpace(marker)) nextTests.Add(marker!);
            }
        }

        return new ClinicalSummaryViewModel
        {
            Available = true,
            UploadId = root.TryGetProperty("upload_id", out var uploadEl) ? uploadEl.GetString() : null,
            GeneratedAt = root.TryGetProperty("generated_at", out var genEl) && genEl.ValueKind == JsonValueKind.String
                && DateTimeOffset.TryParse(genEl.GetString(), out var parsed) ? parsed : null,
            TopPatterns = ParsePatterns(root, "top_patterns"),
            RedFlags = ParsePatterns(root, "red_flags"),
            EvidenceGapCount = evidenceGaps.ValueKind == JsonValueKind.Object && evidenceGaps.TryGetProperty("gap_count", out var gc) ? gc.GetInt32() : 0,
            HighPriorityGapCount = evidenceGaps.ValueKind == JsonValueKind.Object && evidenceGaps.TryGetProperty("high_priority_count", out var hpc) ? hpc.GetInt32() : 0,
            NextBestTests = nextTests,
            ProgressAvailable = progressAvailable,
            ProgressChanges = progressChanges,
            RequiresDoctorDiscussion = root.TryGetProperty("requires_doctor_discussion", out var rdd) && rdd.GetBoolean(),
            ActionPlan = root.TryGetProperty("action_plan_by_role", out var apEl) && apEl.ValueKind == JsonValueKind.Object
                ? ParseActionPlan(apEl)
                : null,
            ReasoningMap = ParseReasoningMap(root),
            EvidenceDebt = ParseEvidenceDebtSummary(root),
            ReportQualityAudit = ParseReportQualityAuditSummary(root),
            PopulationProfileSelection = ParsePopulationProfileSelection(root),
            PopulationProfileOverlays = ParsePopulationProfileOverlays(root),
            DoctorEscalationPrecision = ParseDoctorEscalationPrecision(root),
        };
    }

    // P30: population_profile_selection (backend/app/services/
    // population_profile_selection.py) -- pure pass-through, null when
    // the report predates P24.3.
    private static PopulationProfileSelectionViewModel? ParsePopulationProfileSelection(JsonElement root)
    {
        if (!root.TryGetProperty("population_profile_selection", out var ppsEl) || ppsEl.ValueKind != JsonValueKind.Object)
        {
            return null;
        }
        var activeIds = ReadStringArray(ppsEl, "active_profile_ids");
        var ignoredIds = ReadStringArray(ppsEl, "ignored_profile_ids");
        var reasons = ReadStringArray(ppsEl, "selection_reasons");
        if (activeIds.Count == 0 && ignoredIds.Count == 0 && reasons.Count == 0
            && !ppsEl.TryGetProperty("selection_source", out _))
        {
            return null;
        }
        return new PopulationProfileSelectionViewModel
        {
            ActiveProfileIds = activeIds,
            SelectionSource = ppsEl.TryGetProperty("selection_source", out var ssEl) && ssEl.ValueKind == JsonValueKind.String ? ssEl.GetString() : null,
            SelectionReasons = reasons,
            IgnoredProfileIds = ignoredIds,
        };
    }

    // P30: population_profile_overlays (backend/app/services/
    // population_profiles.py) -- pure pass-through, null/empty when the
    // report predates P24.
    private static PopulationProfileOverlaysViewModel? ParsePopulationProfileOverlays(JsonElement root)
    {
        if (!root.TryGetProperty("population_profile_overlays", out var ppoEl) || ppoEl.ValueKind != JsonValueKind.Object
            || !ppoEl.TryGetProperty("profiles", out var profilesEl) || profilesEl.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var profiles = new List<ProfileOverlayViewModel>();
        foreach (var profile in profilesEl.EnumerateArray())
        {
            if (profile.ValueKind != JsonValueKind.Object) continue;

            var adjustments = new List<PriorityAdjustmentViewModel>();
            if (profile.TryGetProperty("priority_adjustments", out var paEl) && paEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var adj in paEl.EnumerateArray())
                {
                    if (adj.ValueKind != JsonValueKind.Object) continue;
                    adjustments.Add(new PriorityAdjustmentViewModel
                    {
                        Domain = adj.TryGetProperty("domain", out var d) ? d.GetString() ?? "" : "",
                        Label = adj.TryGetProperty("label", out var l) && l.ValueKind == JsonValueKind.String ? l.GetString() : null,
                        CalibratedConfidence = adj.TryGetProperty("calibrated_confidence", out var cc) && cc.ValueKind == JsonValueKind.String ? cc.GetString() : null,
                        ProfileEmphasis = adj.TryGetProperty("profile_emphasis", out var pe) && pe.ValueKind == JsonValueKind.String ? pe.GetString() ?? "standard" : "standard",
                        Reason = adj.TryGetProperty("reason", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString() : null,
                    });
                }
            }

            var nextTests = new List<NextTestEmphasisViewModel>();
            if (profile.TryGetProperty("next_test_emphasis", out var nteEl) && nteEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var nte in nteEl.EnumerateArray())
                {
                    if (nte.ValueKind != JsonValueKind.Object) continue;
                    nextTests.Add(new NextTestEmphasisViewModel
                    {
                        Domain = nte.TryGetProperty("domain", out var d) ? d.GetString() ?? "" : "",
                        Marker = nte.TryGetProperty("marker", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null,
                        Priority = nte.TryGetProperty("priority", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null,
                        AlreadyBeingAddressed = nte.TryGetProperty("already_being_addressed", out var aba) && aba.ValueKind == JsonValueKind.True,
                        Reason = nte.TryGetProperty("reason", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString() : null,
                    });
                }
            }

            profiles.Add(new ProfileOverlayViewModel
            {
                ProfileId = profile.TryGetProperty("profile_id", out var pid) ? pid.GetString() ?? "" : "",
                Label = profile.TryGetProperty("label", out var lbl) && lbl.ValueKind == JsonValueKind.String ? lbl.GetString() ?? "" : "",
                PriorityAdjustments = adjustments,
                NextTestEmphasis = nextTests,
                PractitionerPrompts = ReadStringArray(profile, "practitioner_prompts"),
            });
        }

        if (profiles.Count == 0) return null;
        return new PopulationProfileOverlaysViewModel { Profiles = profiles };
    }

    // P30: doctor_escalation_precision (backend/app/services/
    // doctor_escalation_precision.py) -- pure pass-through. Unlike P29's
    // b2c UI, the practitioner audience is allowed to see reason_codes,
    // related_hypotheses, and related_contradictions.
    private static DoctorEscalationPrecisionViewModel? ParseDoctorEscalationPrecision(JsonElement root)
    {
        if (!root.TryGetProperty("doctor_escalation_precision", out var depEl) || depEl.ValueKind != JsonValueKind.Object
            || !depEl.TryGetProperty("escalations", out var escEl) || escEl.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var escalations = new List<DoctorEscalationItemViewModel>();
        foreach (var item in escEl.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) continue;
            escalations.Add(new DoctorEscalationItemViewModel
            {
                Id = item.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String ? idEl.GetString() : null,
                Level = item.TryGetProperty("level", out var lvlEl) ? lvlEl.GetString() ?? "" : "",
                RecommendedTiming = item.TryGetProperty("recommended_timing", out var rtEl) && rtEl.ValueKind == JsonValueKind.String ? rtEl.GetString() : null,
                Domain = item.TryGetProperty("domain", out var domEl) ? domEl.GetString() ?? "" : "",
                ReasonCodes = ReadStringArray(item, "reason_codes"),
                RelatedMarkers = ReadStringArray(item, "related_markers"),
                RelatedSymptoms = ReadStringArray(item, "related_symptoms"),
                RelatedHypotheses = ReadStringArray(item, "related_hypotheses"),
                RelatedContradictions = ReadStringArray(item, "related_contradictions"),
                HumanReadableReason = item.TryGetProperty("human_readable_reason", out var hrrEl) && hrrEl.ValueKind == JsonValueKind.String ? hrrEl.GetString() : null,
            });
        }

        if (escalations.Count == 0) return null;
        return new DoctorEscalationPrecisionViewModel
        {
            OverallLevel = depEl.TryGetProperty("overall_level", out var olEl) && olEl.ValueKind == JsonValueKind.String ? olEl.GetString() : null,
            RecommendedTiming = depEl.TryGetProperty("recommended_timing", out var rtEl2) && rtEl2.ValueKind == JsonValueKind.String ? rtEl2.GetString() : null,
            Escalations = escalations,
        };
    }

    // Shared helper: reads a JSON array property into a list of strings,
    // tolerating non-string entries (skipped) and a missing/malformed
    // property (empty list) -- same fail-open posture as every other
    // parser in this file.
    private static IReadOnlyList<string> ReadStringArray(JsonElement root, string propertyName)
    {
        var result = new List<string>();
        if (!root.TryGetProperty(propertyName, out var arrEl) || arrEl.ValueKind != JsonValueKind.Array)
        {
            return result;
        }
        foreach (var entry in arrEl.EnumerateArray())
        {
            if (entry.ValueKind == JsonValueKind.String)
            {
                var value = entry.GetString();
                if (!string.IsNullOrWhiteSpace(value)) result.Add(value!);
            }
        }
        return result;
    }

    // P18b: builds the practitioner-facing Clinical Reasoning Map cards —
    // the same cross-referencing P18's frontend adapter does
    // (frontend/src/lib/clinicalReasoningMap.js), reimplemented here over
    // the raw JSON since the CRM is a separate .NET app with no shared
    // JS runtime. Presentation-only: every field read here was already
    // computed by the backend pipeline (P14-P22), nothing is recomputed.
    private static IReadOnlyList<ReasoningMapCardViewModel> ParseReasoningMap(JsonElement root)
    {
        var cards = new List<ReasoningMapCardViewModel>();

        if (!root.TryGetProperty("clinical_hypotheses", out var chEl) || chEl.ValueKind != JsonValueKind.Object
            || !chEl.TryGetProperty("hypotheses", out var hypEl) || hypEl.ValueKind != JsonValueKind.Array)
        {
            return cards;
        }

        var contradictions = root.TryGetProperty("clinical_contradictions", out var ccEl) && ccEl.ValueKind == JsonValueKind.Object
            && ccEl.TryGetProperty("contradictions", out var contArrEl) && contArrEl.ValueKind == JsonValueKind.Array
            ? contArrEl.EnumerateArray().ToList()
            : new List<JsonElement>();

        var attributions = root.TryGetProperty("outcome_attribution", out var oaEl) && oaEl.ValueKind == JsonValueKind.Object
            && oaEl.TryGetProperty("attributions", out var attrArrEl) && attrArrEl.ValueKind == JsonValueKind.Array
            ? attrArrEl.EnumerateArray().ToList()
            : new List<JsonElement>();

        var domainDebt = root.TryGetProperty("evidence_debt", out var edEl) && edEl.ValueKind == JsonValueKind.Object
            && edEl.TryGetProperty("domain_debt", out var ddArrEl) && ddArrEl.ValueKind == JsonValueKind.Array
            ? ddArrEl.EnumerateArray().ToList()
            : new List<JsonElement>();

        Dictionary<string, List<ActionPlanItemViewModel>>? actionBuckets = null;
        if (root.TryGetProperty("action_plan_by_role", out var abEl) && abEl.ValueKind == JsonValueKind.Object)
        {
            actionBuckets = new Dictionary<string, List<ActionPlanItemViewModel>>();
            foreach (var bucket in new[] { "urgent", "doctor", "practitioner", "self" })
            {
                actionBuckets[bucket] = ParseActionPlanBucket(abEl, bucket).ToList();
            }
        }

        static string? GetString(JsonElement el, string prop) =>
            el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        foreach (var hypothesis in hypEl.EnumerateArray().Take(3))
        {
            var domain = GetString(hypothesis, "domain") ?? "";
            var hypothesisId = GetString(hypothesis, "hypothesis_id") ?? "";
            var calibratedConfidence = GetString(hypothesis, "calibrated_confidence") ?? GetString(hypothesis, "likelihood_bucket");
            double? calibratedScore = hypothesis.TryGetProperty("calibrated_score", out var scoreEl) && scoreEl.ValueKind == JsonValueKind.Number
                ? scoreEl.GetDouble()
                : hypothesis.TryGetProperty("confidence_score", out var rawScoreEl) && rawScoreEl.ValueKind == JsonValueKind.Number
                    ? rawScoreEl.GetDouble()
                    : null;
            var doctorOnly = (hypothesis.TryGetProperty("doctor_only", out var doEl) && doEl.ValueKind == JsonValueKind.True)
                || (hypothesis.TryGetProperty("doctor_flag", out var dfEl) && dfEl.ValueKind == JsonValueKind.True);

            var supportingEvidence = new List<string>();
            if (hypothesis.TryGetProperty("supporting_evidence", out var seEl) && seEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var marker in seEl.EnumerateArray())
                {
                    var name = marker.ValueKind == JsonValueKind.String
                        ? marker.GetString()
                        : GetString(marker, "name") ?? GetString(marker, "canonical_name");
                    if (!string.IsNullOrWhiteSpace(name)) supportingEvidence.Add(name!);
                }
            }

            var nextTests = new List<string>();
            if (hypothesis.TryGetProperty("what_would_confirm_or_rule_out", out var wtEl) && wtEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var test in wtEl.EnumerateArray())
                {
                    var marker = test.ValueKind == JsonValueKind.String
                        ? test.GetString()
                        : GetString(test, "marker") ?? GetString(test, "name");
                    if (!string.IsNullOrWhiteSpace(marker)) nextTests.Add(marker!);
                }
            }

            var limitations = new List<string>();
            foreach (var contradiction in contradictions)
            {
                var contDomain = GetString(contradiction, "domain") ?? "";
                var related = contradiction.TryGetProperty("related_hypotheses", out var relEl) && relEl.ValueKind == JsonValueKind.Array
                    && relEl.EnumerateArray().Any(r => r.ValueKind == JsonValueKind.String && r.GetString() == hypothesisId);
                if (contDomain == domain || related)
                {
                    var message = GetString(contradiction, "message");
                    if (!string.IsNullOrWhiteSpace(message)) limitations.Add(message!);
                }
            }
            foreach (var attribution in attributions)
            {
                if (GetString(attribution, "domain") != domain) continue;
                if (attribution.TryGetProperty("confounders", out var confEl) && confEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var confounder in confEl.EnumerateArray())
                    {
                        if (confounder.ValueKind == JsonValueKind.String) limitations.Add(confounder.GetString()!);
                    }
                }
            }

            var debtEntry = domainDebt.FirstOrDefault(d => GetString(d, "domain") == domain);
            var debtLevel = debtEntry.ValueKind == JsonValueKind.Object ? GetString(debtEntry, "debt_level") : null;

            var actionBucket = "self";
            if (actionBuckets is not null)
            {
                var matched = actionBuckets.FirstOrDefault(kv => kv.Value.Any(i => i.Title == GetString(hypothesis, "label")));
                if (matched.Key is not null) actionBucket = matched.Key;
                else actionBucket = FallbackActionBucket(doctorOnly, calibratedConfidence);
            }
            else
            {
                actionBucket = FallbackActionBucket(doctorOnly, calibratedConfidence);
            }

            cards.Add(new ReasoningMapCardViewModel
            {
                Domain = domain,
                Label = GetString(hypothesis, "label") ?? hypothesisId,
                CalibratedConfidence = calibratedConfidence,
                CalibratedScore = calibratedScore,
                DebtLevel = debtLevel,
                SupportingEvidence = supportingEvidence,
                Limitations = limitations,
                NextTests = nextTests,
                ActionBucket = actionBucket,
            });
        }

        return cards;
    }

    // Mirrors action_plan_by_role.py's own priority order (urgent > doctor
    // > practitioner > self) using only the calibration fields every
    // hypothesis already carries — same fallback logic as P18's frontend
    // adapter (frontend/src/lib/clinicalReasoningMap.js::fallbackActionBucket).
    private static string FallbackActionBucket(bool doctorOnly, string? calibratedConfidence)
    {
        if (doctorOnly || calibratedConfidence == "doctor_only") return "doctor";
        if (calibratedConfidence is "blocked" or "moderate" or "possible") return "practitioner";
        return "self";
    }

    private static EvidenceDebtSummaryViewModel? ParseEvidenceDebtSummary(JsonElement root)
    {
        if (!root.TryGetProperty("evidence_debt", out var edEl) || edEl.ValueKind != JsonValueKind.Object)
        {
            return null;
        }
        return new EvidenceDebtSummaryViewModel
        {
            OverallDebt = edEl.TryGetProperty("overall_debt", out var od) && od.ValueKind == JsonValueKind.String ? od.GetString() : null,
            OverallScore = edEl.TryGetProperty("overall_score", out var os) && os.ValueKind == JsonValueKind.Number ? os.GetDouble() : null,
        };
    }

    private static ReportQualityAuditSummaryViewModel? ParseReportQualityAuditSummary(JsonElement root)
    {
        if (!root.TryGetProperty("report_quality_audit", out var rqaEl) || rqaEl.ValueKind != JsonValueKind.Object)
        {
            return null;
        }
        var summary = rqaEl.TryGetProperty("summary", out var sEl) && sEl.ValueKind == JsonValueKind.Object ? sEl : default;
        int GetInt(string prop) => summary.ValueKind == JsonValueKind.Object
            && summary.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : 0;

        return new ReportQualityAuditSummaryViewModel
        {
            AuditStatus = rqaEl.TryGetProperty("audit_status", out var asEl) && asEl.ValueKind == JsonValueKind.String ? asEl.GetString() : null,
            MarkersReviewed = GetInt("markers_reviewed"),
            DomainsAssessed = GetInt("domains_assessed"),
            HighConfidenceItems = GetInt("high_confidence_items"),
            BlockedOrLowConfidenceItems = GetInt("blocked_or_low_confidence_items"),
        };
    }

    private static ActionPlanByRoleViewModel ParseActionPlan(JsonElement root) => new()
    {
        Urgent = ParseActionPlanBucket(root, "urgent"),
        Doctor = ParseActionPlanBucket(root, "doctor"),
        Practitioner = ParseActionPlanBucket(root, "practitioner"),
        Self = ParseActionPlanBucket(root, "self"),
    };

    private static IReadOnlyList<ActionPlanItemViewModel> ParseActionPlanBucket(JsonElement root, string bucketName)
    {
        var result = new List<ActionPlanItemViewModel>();
        if (!root.TryGetProperty(bucketName, out var arrayEl) || arrayEl.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var item in arrayEl.EnumerateArray())
        {
            result.Add(new ActionPlanItemViewModel
            {
                Title = item.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
                Reason = item.TryGetProperty("reason", out var r) && r.ValueKind == JsonValueKind.String ? r.GetString() : null,
            });
        }

        return result;
    }

    private static IReadOnlyList<ClinicalPatternViewModel> ParsePatterns(JsonElement root, string propertyName)
    {
        var result = new List<ClinicalPatternViewModel>();
        if (!root.TryGetProperty(propertyName, out var arrayEl) || arrayEl.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var item in arrayEl.EnumerateArray())
        {
            double? confidence = item.TryGetProperty("confidence", out var confEl) && confEl.ValueKind == JsonValueKind.Number
                ? confEl.GetDouble() : null;
            var userExplanation = item.TryGetProperty("user_explanation", out var ueEl) ? ueEl : default;
            result.Add(new ClinicalPatternViewModel
            {
                PatternId = item.TryGetProperty("pattern_id", out var pid) ? pid.GetString() ?? "" : "",
                PatternName = item.TryGetProperty("pattern_name", out var pn) ? pn.GetString() ?? "" : "",
                Domain = item.TryGetProperty("domain", out var dm) ? dm.GetString() ?? "" : "",
                Confidence = confidence,
                Severity = item.TryGetProperty("severity", out var sev) && sev.ValueKind == JsonValueKind.String ? sev.GetString() : null,
                DoctorFlag = item.TryGetProperty("doctor_flag", out var df) && df.ValueKind == JsonValueKind.True,
                SafetyLevel = item.TryGetProperty("safety_level", out var sl) && sl.ValueKind == JsonValueKind.String ? sl.GetString() : null,
                Summary = userExplanation.ValueKind == JsonValueKind.Object && userExplanation.TryGetProperty("summary", out var sum) ? sum.GetString() : null,
                PractitionerExplanation = item.TryGetProperty("practitioner_explanation", out var pe) && pe.ValueKind == JsonValueKind.String ? pe.GetString() : null,
            });
        }

        return result;
    }

    [HttpPost("{assignmentId:guid}/update")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Update(Guid assignmentId, [FromForm] string status, [FromForm] string notes, CancellationToken ct)
    {
        var userCtx = await EnsureActiveOrganization(await _userContextAccessor.GetOrThrow(ct), ct);
        if (!userCtx.ActiveOrganizationId.HasValue)
        {
            TempData["ErrorMessage"] = "No active organization selected.";
            return RedirectToAction(nameof(Index));
        }

        try
        {
            await _assignmentService.UpdateAssignment(userCtx, userCtx.ActiveOrganizationId.Value, assignmentId, status, notes, ct);
            TempData["SuccessMessage"] = "Client status and notes updated.";
            return RedirectToAction(nameof(Profile), new { assignmentId });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Assignment update failed for {AssignmentId}", assignmentId);
            TempData["ErrorMessage"] = "Failed to update client details.";
            return RedirectToAction(nameof(Profile), new { assignmentId });
        }
    }

    private async Task<Vitaloop.Crm.Web.Models.Auth.UserContext> EnsureActiveOrganization(
        Vitaloop.Crm.Web.Models.Auth.UserContext userCtx,
        CancellationToken ct)
    {
        if (userCtx.ActiveOrganizationId.HasValue)
        {
            return userCtx;
        }

        if (!_accessPolicyService.HasGlobalRole(userCtx, "super_admin"))
        {
            return userCtx;
        }

        var organizations = await _organizationService.GetOrganizations(userCtx, ct);
        var firstOrgId = organizations.FirstOrDefault()?.Id;
        if (firstOrgId.HasValue)
        {
            await _activeOrganizationResolver.SetActiveOrganizationId(firstOrgId.Value, ct);
            userCtx.ActiveOrganizationId = firstOrgId.Value;
        }

        return userCtx;
    }
}
