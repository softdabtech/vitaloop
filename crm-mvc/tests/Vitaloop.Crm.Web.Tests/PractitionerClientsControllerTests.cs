using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Vitaloop.Crm.Web.Areas.Practitioner.Controllers;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.ViewModels;
using Xunit;

namespace Vitaloop.Crm.Web.Tests;

// P8 Practitioner Mode: Areas/Practitioner/Controllers/ClientsController.Profile
// parses the backend's GET /admin/clients/{clientId}/clinical-summary
// JsonDocument into ClinicalSummaryViewModel. These tests exercise that
// parsing end to end through the real controller action, using
// FakeCrmDataGateway.ClinicalSummaryDocument to stand in for the HTTP call.
public class PractitionerClientsControllerTests
{
    private static ClientsController CreateController(
        FakeCrmDataGateway gateway,
        Assignment assignment,
        Guid orgId)
    {
        var userCtx = TestUsers.Practitioner(orgId, assignment.PractitionerId ?? Guid.NewGuid());
        var policy = new FakeAccessPolicyService { HasOrgRoleResult = true, CanAccessOrgResult = true };
        var orgService = new OrganizationService(gateway, policy);
        var assignmentService = new AssignmentService(gateway, policy);
        gateway.Assignments = new[] { assignment };

        var controller = new ClientsController(
            new FakeUserContextAccessor(userCtx),
            new FakeActiveOrganizationResolver(),
            assignmentService,
            policy,
            orgService,
            gateway,
            NullLogger<ClientsController>.Instance);

        var http = new DefaultHttpContext();
        controller.ControllerContext = new ControllerContext { HttpContext = http };
        controller.TempData = new Microsoft.AspNetCore.Mvc.ViewFeatures.TempDataDictionary(http, new NullTempDataProviderForPractitionerTests());
        return controller;
    }

    private static Assignment MakeAssignment(Guid orgId, Guid clientId, Guid practitionerId) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = orgId,
        ClientId = clientId,
        ClientName = "Test Client",
        PractitionerId = practitionerId,
        PractitionerName = "Test Practitioner",
        Status = "active",
        Notes = "",
        UpdatedAt = DateTimeOffset.UtcNow,
    };

    [Fact]
    public async Task Profile_Parses_Top_Patterns_Red_Flags_And_Progress()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            {
              "client_id": "abc",
              "available": true,
              "upload_id": "upload-1",
              "generated_at": "2026-09-14T00:00:00Z",
              "top_patterns": [
                {
                  "pattern_id": "electrolyte_kidney_safety",
                  "pattern_name": "Electrolyte / Kidney Safety",
                  "domain": "kidney",
                  "confidence": 0.9,
                  "severity": "high",
                  "doctor_flag": true,
                  "safety_level": "high_confidence_urgent",
                  "user_explanation": { "summary": "Needs prompt review." }
                },
                {
                  "pattern_id": "iron_deficiency_anemia",
                  "pattern_name": "Iron Deficiency Anemia",
                  "domain": "iron_status",
                  "confidence": 0.7,
                  "severity": "moderate",
                  "doctor_flag": false,
                  "user_explanation": { "summary": "Routine follow-up." }
                }
              ],
              "red_flags": [
                {
                  "pattern_id": "electrolyte_kidney_safety",
                  "pattern_name": "Electrolyte / Kidney Safety",
                  "domain": "kidney",
                  "confidence": 0.9,
                  "severity": "high",
                  "doctor_flag": true
                }
              ],
              "evidence_gaps_summary": { "gap_count": 3, "high_priority_count": 1 },
              "next_best_tests": [ { "marker": "ferritin" }, { "marker": "tsh" } ],
              "progress_since_last": {
                "available": true,
                "changes": [
                  { "pattern_name": "Iron Deficiency Anemia", "status": "weakened" }
                ]
              },
              "safety_status": "approved_with_warnings",
              "requires_doctor_discussion": true
            }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        var summary = model.ClinicalSummary;
        Assert.NotNull(summary);
        Assert.True(summary!.Available);
        Assert.True(summary.RequiresDoctorDiscussion);
        Assert.Equal(2, summary.TopPatterns.Count);
        Assert.Single(summary.RedFlags);
        Assert.Equal("electrolyte_kidney_safety", summary.RedFlags[0].PatternId);
        Assert.Equal(3, summary.EvidenceGapCount);
        Assert.Equal(1, summary.HighPriorityGapCount);
        Assert.Equal(new[] { "ferritin", "tsh" }, summary.NextBestTests);
        Assert.True(summary.ProgressAvailable);
        Assert.Single(summary.ProgressChanges);
        Assert.Equal("weakened", summary.ProgressChanges[0].Status);
    }

    [Fact]
    public async Task Profile_Handles_Unavailable_Summary_Gracefully()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            { "client_id": "abc", "available": false, "reason": "no_completed_report_for_client" }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        Assert.NotNull(model.ClinicalSummary);
        Assert.False(model.ClinicalSummary!.Available);
        Assert.Equal("no_completed_report_for_client", model.ClinicalSummary.Reason);
    }

    [Fact]
    public async Task Profile_Parses_Reasoning_Map_Cards_With_Limitations_And_Debt()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            {
              "client_id": "abc",
              "available": true,
              "clinical_hypotheses": {
                "hypotheses": [
                  {
                    "hypothesis_id": "h1",
                    "domain": "iron_status",
                    "label": "Possible iron availability pattern",
                    "calibrated_confidence": "moderate",
                    "calibrated_score": 0.6,
                    "supporting_evidence": [{ "name": "ferritin" }],
                    "what_would_confirm_or_rule_out": [{ "marker": "transferrin saturation" }]
                  }
                ]
              },
              "clinical_contradictions": {
                "contradictions": [
                  { "id": "c1", "domain": "iron_status", "message": "Inflammation may limit ferritin interpretation.", "related_hypotheses": [] }
                ]
              },
              "outcome_attribution": {
                "attributions": [
                  { "domain": "iron_status", "confounders": ["More than one self-reported event overlaps this domain."] }
                ]
              },
              "evidence_debt": {
                "overall_debt": "moderate",
                "overall_score": 0.42,
                "domain_debt": [ { "domain": "iron_status", "debt_level": "high" } ]
              },
              "report_quality_audit": {
                "audit_status": "complete_with_limitations",
                "summary": {
                  "markers_reviewed": 12,
                  "domains_assessed": 4,
                  "high_confidence_items": 1,
                  "blocked_or_low_confidence_items": 2
                }
              },
              "action_plan_by_role": { "urgent": [], "doctor": [], "practitioner": [], "self": [] }
            }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        var summary = model.ClinicalSummary;
        Assert.NotNull(summary);
        Assert.Single(summary!.ReasoningMap);
        var card = summary.ReasoningMap[0];
        Assert.Equal("iron_status", card.Domain);
        Assert.Equal("Possible iron availability pattern", card.Label);
        Assert.Equal("moderate", card.CalibratedConfidence);
        Assert.Equal("high", card.DebtLevel);
        Assert.Contains("ferritin", card.SupportingEvidence);
        Assert.Contains("transferrin saturation", card.NextTests);
        Assert.Contains(card.Limitations, l => l.Contains("Inflammation may limit"));
        Assert.Contains(card.Limitations, l => l.Contains("More than one self-reported event"));
        Assert.Equal("practitioner", card.ActionBucket); // moderate confidence, no matching action-plan entry -> fallback

        Assert.NotNull(summary.EvidenceDebt);
        Assert.Equal("moderate", summary.EvidenceDebt!.OverallDebt);
        Assert.Equal(0.42, summary.EvidenceDebt.OverallScore);

        Assert.NotNull(summary.ReportQualityAudit);
        Assert.Equal("complete_with_limitations", summary.ReportQualityAudit!.AuditStatus);
        Assert.Equal(12, summary.ReportQualityAudit.MarkersReviewed);
        Assert.Equal(2, summary.ReportQualityAudit.BlockedOrLowConfidenceItems);
    }

    [Fact]
    public async Task Profile_Reasoning_Map_Is_Empty_For_Old_Report_Without_P14_Fields()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            { "client_id": "abc", "available": true, "top_patterns": [] }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        var summary = model.ClinicalSummary;
        Assert.NotNull(summary);
        Assert.Empty(summary!.ReasoningMap);
        Assert.Null(summary.EvidenceDebt);
        Assert.Null(summary.ReportQualityAudit);
    }

    [Fact]
    public async Task Profile_Reasoning_Map_Does_Not_Throw_On_Malformed_Nested_Fields()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            {
              "client_id": "abc",
              "available": true,
              "clinical_hypotheses": { "hypotheses": "not_an_array" },
              "clinical_contradictions": "not_an_object",
              "evidence_debt": { "domain_debt": null },
              "report_quality_audit": { "summary": "not_an_object" }
            }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        Assert.NotNull(model.ClinicalSummary);
        Assert.Empty(model.ClinicalSummary!.ReasoningMap);
    }

    // P30 Practitioner CRM Safety & Profile Brief: population_profile_
    // selection/overlays (P24) + doctor_escalation_precision (P25).
    [Fact]
    public async Task Profile_Parses_Population_Profile_And_Doctor_Escalation_Fields()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            {
              "client_id": "abc",
              "available": true,
              "population_profile_selection": {
                "active_profile_ids": ["longevity_metabolic_optimization"],
                "selection_source": "default",
                "selection_reasons": ["No explicit override or strong athletic signal found."],
                "ignored_profile_ids": ["athlete_recovery"]
              },
              "population_profile_overlays": {
                "profiles": [
                  {
                    "profile_id": "longevity_metabolic_optimization",
                    "label": "Longevity & Metabolic Optimization",
                    "priority_adjustments": [
                      {
                        "domain": "cardiometabolic",
                        "hypothesis_id": "h1",
                        "label": "Possible insulin sensitivity pattern",
                        "calibrated_confidence": "moderate",
                        "profile_emphasis": "elevated",
                        "reason": "Within the longevity focus domains and not contradicted in this report."
                      }
                    ],
                    "next_test_emphasis": [
                      { "domain": "cardiometabolic", "marker": "HOMA-IR", "priority": "medium", "already_being_addressed": false, "reason": "Relevant to longevity monitoring in this domain." }
                    ],
                    "practitioner_prompts": [
                      "Consider discussing insulin sensitivity further in the context of longevity."
                    ]
                  }
                ]
              },
              "doctor_escalation_precision": {
                "version": "p25_v1",
                "overall_level": "urgent",
                "recommended_timing": "urgent",
                "escalations": [
                  {
                    "id": "cardiometabolic_urgent_review",
                    "level": "urgent",
                    "recommended_timing": "urgent",
                    "domain": "cardiometabolic",
                    "reason_codes": ["urgent_review_flag_present", "doctor_flag_present"],
                    "related_markers": ["Potassium", "eGFR"],
                    "related_symptoms": ["palpitations"],
                    "related_hypotheses": ["h1"],
                    "related_contradictions": ["Inflammation may limit ferritin interpretation."],
                    "human_readable_reason": "This finding is flagged for urgent review because the report includes an urgent safety signal in cardiometabolic."
                  }
                ]
              }
            }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        var summary = model.ClinicalSummary;
        Assert.NotNull(summary);

        Assert.NotNull(summary!.PopulationProfileSelection);
        Assert.Equal(new[] { "longevity_metabolic_optimization" }, summary.PopulationProfileSelection!.ActiveProfileIds);
        Assert.Equal("default", summary.PopulationProfileSelection.SelectionSource);
        Assert.Single(summary.PopulationProfileSelection.SelectionReasons);
        Assert.Equal(new[] { "athlete_recovery" }, summary.PopulationProfileSelection.IgnoredProfileIds);

        Assert.NotNull(summary.PopulationProfileOverlays);
        Assert.Single(summary.PopulationProfileOverlays!.Profiles);
        var profile = summary.PopulationProfileOverlays.Profiles[0];
        Assert.Equal("Longevity & Metabolic Optimization", profile.Label);
        Assert.Single(profile.PriorityAdjustments);
        Assert.Equal("elevated", profile.PriorityAdjustments[0].ProfileEmphasis);
        Assert.Single(profile.NextTestEmphasis);
        Assert.Equal("HOMA-IR", profile.NextTestEmphasis[0].Marker);
        Assert.Single(profile.PractitionerPrompts);

        Assert.NotNull(summary.DoctorEscalationPrecision);
        Assert.Equal("urgent", summary.DoctorEscalationPrecision!.OverallLevel);
        Assert.Single(summary.DoctorEscalationPrecision.Escalations);
        var escalation = summary.DoctorEscalationPrecision.Escalations[0];
        Assert.Equal("urgent", escalation.Level);
        Assert.Contains("doctor_flag_present", escalation.ReasonCodes);
        Assert.Equal(new[] { "Potassium", "eGFR" }, escalation.RelatedMarkers);
        Assert.Equal(new[] { "h1" }, escalation.RelatedHypotheses);
        Assert.Equal(new[] { "Inflammation may limit ferritin interpretation." }, escalation.RelatedContradictions);
    }

    [Fact]
    public async Task Profile_Safety_Brief_Is_Null_For_Old_Report_Without_P24_P25_Fields()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            { "client_id": "abc", "available": true, "top_patterns": [] }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        var summary = model.ClinicalSummary;
        Assert.NotNull(summary);
        Assert.Null(summary!.PopulationProfileSelection);
        Assert.Null(summary.PopulationProfileOverlays);
        Assert.Null(summary.DoctorEscalationPrecision);
    }

    [Fact]
    public async Task Profile_Safety_Brief_Does_Not_Throw_On_Malformed_Fields()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway
        {
            ClinicalSummaryDocument = JsonDocument.Parse("""
            {
              "client_id": "abc",
              "available": true,
              "population_profile_selection": "not_an_object",
              "population_profile_overlays": { "profiles": "not_an_array" },
              "doctor_escalation_precision": { "escalations": [ "not_an_object", 42, null ] }
            }
            """),
        };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        var summary = model.ClinicalSummary;
        Assert.NotNull(summary);
        Assert.Null(summary!.PopulationProfileSelection);
        Assert.Null(summary.PopulationProfileOverlays);
        Assert.Null(summary.DoctorEscalationPrecision);
    }

    [Fact]
    public async Task Profile_Handles_Null_Document_Without_Throwing()
    {
        var orgId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var practitionerId = Guid.NewGuid();
        var assignment = MakeAssignment(orgId, clientId, practitionerId);
        var gateway = new FakeCrmDataGateway { ClinicalSummaryDocument = null };

        var controller = CreateController(gateway, assignment, orgId);
        var result = await controller.Profile(assignment.Id, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<PractitionerClientProfileViewModel>(view.Model);
        Assert.Null(model.ClinicalSummary);
        Assert.NotNull(model.Assignment);
    }
}

internal sealed class NullTempDataProviderForPractitionerTests
    : Microsoft.AspNetCore.Mvc.ViewFeatures.ITempDataProvider
{
    public IDictionary<string, object> LoadTempData(HttpContext _) => new Dictionary<string, object>();
    public void SaveTempData(HttpContext _, IDictionary<string, object> __) { }
}
