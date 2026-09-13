using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;
using Vitaloop.Crm.Web.ViewModels;

namespace Vitaloop.Crm.Web.Areas.Ops.Controllers;

/// <summary>
/// Knowledge-rule governance: approving a rule (governance_status
/// reviewed -> active) is a real clinical sign-off — the reviewer confirms
/// the rule's conditions/thresholds/outputs are clinically correct before it
/// starts interpreting real users' lab results (see
/// backend/app/services/knowledge/governance.py::approve_rule). This
/// controller is intentionally the ONLY UI surface for that action; there is
/// no automated or bulk approval path, on purpose.
/// </summary>
[Area("Ops")]
[Route("ops/knowledge-rules")]
[RequireGlobalRole("super_admin")]
public class KnowledgeRulesController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly ICrmDataGateway _gateway;
    private readonly ILogger<KnowledgeRulesController> _logger;

    public KnowledgeRulesController(
        IUserContextAccessor userContextAccessor,
        ICrmDataGateway gateway,
        ILogger<KnowledgeRulesController> logger)
    {
        _userContextAccessor = userContextAccessor;
        _gateway = gateway;
        _logger = logger;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index([FromQuery] string? governanceStatus, [FromQuery] string? key, CancellationToken ct)
    {
        // "reviewed" (awaiting approval) is the default view — that's the
        // actual work queue this page exists for.
        var effectiveStatus = string.IsNullOrWhiteSpace(governanceStatus) ? "reviewed" : governanceStatus;

        try
        {
            var rules = await _gateway.GetKnowledgeRules(
                governanceStatus: effectiveStatus == "all" ? null : effectiveStatus,
                key: key,
                ct);

            return View(new OpsKnowledgeRulesPageViewModel
            {
                Rules = rules,
                GovernanceStatus = effectiveStatus,
                Key = key,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load knowledge rules");
            return View(new OpsKnowledgeRulesPageViewModel
            {
                GovernanceStatus = effectiveStatus,
                Key = key,
                ErrorMessage = "Knowledge rules are temporarily unavailable.",
            });
        }
    }

    [HttpGet("{ruleId}")]
    public async Task<IActionResult> Details(string ruleId, CancellationToken ct)
    {
        var detail = await _gateway.GetKnowledgeRule(ruleId, ct);
        if (detail is null)
        {
            TempData["ErrorMessage"] = "Rule not found.";
            return RedirectToAction(nameof(Index));
        }

        return View(detail);
    }

    [HttpPost("{ruleId}/approve")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Approve(string ruleId, [FromForm] string changeNote, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(changeNote))
        {
            TempData["ErrorMessage"] = "change_note is required to approve a rule.";
            return RedirectToAction(nameof(Index));
        }

        try
        {
            var userCtx = await _userContextAccessor.GetOrThrow(ct);
            await _gateway.ApproveKnowledgeRule(
                ruleId,
                new Models.Crm.KnowledgeRuleApprovePayload
                {
                    MedicalReviewedBy = userCtx.UserId.ToString(),
                    MedicalReviewedAt = DateTimeOffset.UtcNow,
                    LastModifiedBy = userCtx.UserId.ToString(),
                    ChangeNote = changeNote.Trim(),
                },
                ct);

            TempData["SuccessMessage"] = $"Rule approved and activated. Reviewed by {userCtx.Email}.";
        }
        catch (KnowledgeRuleApprovalException ex)
        {
            // The backend's own refusal reason (e.g. "Only reviewed rules
            // can be approved") — surfaced verbatim rather than a generic
            // failure, since a reviewer needs to know why.
            TempData["ErrorMessage"] = ex.Message;
        }
        catch (UnauthorizedAccessException)
        {
            TempData["ErrorMessage"] = "Insufficient permissions.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to approve knowledge rule {RuleId}", ruleId);
            TempData["ErrorMessage"] = "Failed to approve rule.";
        }

        return RedirectToAction(nameof(Index));
    }
}
