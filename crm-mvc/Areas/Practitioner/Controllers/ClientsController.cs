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
