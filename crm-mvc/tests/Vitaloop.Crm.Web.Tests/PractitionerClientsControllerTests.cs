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
