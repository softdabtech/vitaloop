using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.Extensions.Logging.Abstractions;
using Vitaloop.Crm.Web.Areas.Ops.Controllers;
using Vitaloop.Crm.Web.Models.Crm;
using Vitaloop.Crm.Web.Services.Data;
using Vitaloop.Crm.Web.ViewModels;
using Xunit;

namespace Vitaloop.Crm.Web.Tests;

public class KnowledgeRulesControllerTests
{
    [Fact]
    public async Task Index_Defaults_To_Reviewed_Status()
    {
        var gateway = new FakeCrmDataGateway
        {
            KnowledgeRules =
            [
                new KnowledgeRuleListItem { Id = "r1", Key = "rule_high_ldl", Name = "High LDL", GovernanceStatus = "reviewed" }
            ]
        };
        var controller = new KnowledgeRulesController(
            new FakeUserContextAccessor(TestUsers.SuperAdmin(null)),
            gateway,
            NullLogger<KnowledgeRulesController>.Instance);
        AttachMvcContext(controller);

        var result = await controller.Index(governanceStatus: null, key: null, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<OpsKnowledgeRulesPageViewModel>(view.Model);
        Assert.Equal("reviewed", model.GovernanceStatus);
        Assert.Single(model.Rules);
    }

    [Fact]
    public async Task Index_Handles_Gateway_Failure_Gracefully()
    {
        var controller = new KnowledgeRulesController(
            new FakeUserContextAccessor(TestUsers.SuperAdmin(null)),
            new ThrowingCrmDataGateway(),
            NullLogger<KnowledgeRulesController>.Instance);
        AttachMvcContext(controller);

        var result = await controller.Index(governanceStatus: null, key: null, CancellationToken.None);

        var view = Assert.IsType<ViewResult>(result);
        var model = Assert.IsType<OpsKnowledgeRulesPageViewModel>(view.Model);
        Assert.False(string.IsNullOrEmpty(model.ErrorMessage));
    }

    [Fact]
    public async Task Details_Rule_Not_Found_Redirects_To_Index()
    {
        var gateway = new FakeCrmDataGateway { OneKnowledgeRule = null };
        var controller = new KnowledgeRulesController(
            new FakeUserContextAccessor(TestUsers.SuperAdmin(null)),
            gateway,
            NullLogger<KnowledgeRulesController>.Instance);
        AttachMvcContext(controller);

        var result = await controller.Details("missing-id", CancellationToken.None);

        var redirect = Assert.IsType<RedirectToActionResult>(result);
        Assert.Equal(nameof(KnowledgeRulesController.Index), redirect.ActionName);
    }

    [Fact]
    public async Task Approve_Requires_ChangeNote()
    {
        var gateway = new FakeCrmDataGateway();
        var controller = new KnowledgeRulesController(
            new FakeUserContextAccessor(TestUsers.SuperAdmin(null)),
            gateway,
            NullLogger<KnowledgeRulesController>.Instance);
        AttachMvcContext(controller);

        var result = await controller.Approve("rule-1", changeNote: "", CancellationToken.None);

        Assert.IsType<RedirectToActionResult>(result);
        Assert.Null(gateway.LastApprovedRuleId);
    }

    [Fact]
    public async Task Approve_Sends_Reviewer_Identity_As_Medical_Reviewed_By()
    {
        var reviewer = TestUsers.SuperAdmin(null);
        var gateway = new FakeCrmDataGateway
        {
            OneKnowledgeRule = new KnowledgeRuleDetail { Id = "rule-1", Key = "rule_high_ldl", GovernanceStatus = "reviewed" }
        };
        var controller = new KnowledgeRulesController(
            new FakeUserContextAccessor(reviewer),
            gateway,
            NullLogger<KnowledgeRulesController>.Instance);
        AttachMvcContext(controller);

        var result = await controller.Approve("rule-1", changeNote: "Reviewed thresholds against guidelines.", CancellationToken.None);

        Assert.IsType<RedirectToActionResult>(result);
        Assert.Equal("rule-1", gateway.LastApprovedRuleId);
        Assert.NotNull(gateway.LastApprovePayload);
        Assert.Equal(reviewer.UserId.ToString(), gateway.LastApprovePayload!.MedicalReviewedBy);
        Assert.Equal("Reviewed thresholds against guidelines.", gateway.LastApprovePayload.ChangeNote);
    }

    [Fact]
    public async Task Approve_Surfaces_Backend_Refusal_Reason()
    {
        var gateway = new FakeCrmDataGateway
        {
            ApproveThrows = new KnowledgeRuleApprovalException("Only reviewed rules can be approved"),
        };
        var controller = new KnowledgeRulesController(
            new FakeUserContextAccessor(TestUsers.SuperAdmin(null)),
            gateway,
            NullLogger<KnowledgeRulesController>.Instance);
        AttachMvcContext(controller);

        var result = await controller.Approve("rule-1", changeNote: "note", CancellationToken.None);

        Assert.IsType<RedirectToActionResult>(result);
        Assert.Equal("Only reviewed rules can be approved", controller.TempData["ErrorMessage"]);
    }

    private static void AttachMvcContext(Controller controller)
    {
        var http = new DefaultHttpContext();
        controller.ControllerContext = new ControllerContext { HttpContext = http };
        controller.TempData = new TempDataDictionary(http, new NullTempDataProvider());
    }

    private sealed class NullTempDataProvider : ITempDataProvider
    {
        public IDictionary<string, object> LoadTempData(HttpContext context) => new Dictionary<string, object>();

        public void SaveTempData(HttpContext context, IDictionary<string, object> values)
        {
        }
    }

    private sealed class ThrowingCrmDataGateway : ICrmDataGateway
    {
        public Task<Organization?> CreateOrganization(Guid ownerId, string name, string slug, string status, string? description, string? logoUrl, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Organization>> GetOrganizations(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Organization?> GetOrganization(Guid orgId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<OrganizationSettings?> GetOrganizationSettings(Guid orgId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task UpdateOrganization(Guid orgId, UpdateOrganizationRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Member>> GetMembers(Guid orgId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task ChangeRole(Guid orgId, Guid userId, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task UpdateMemberProfile(Guid orgId, Guid userId, string? fullName, int? age, string? sex, string? subscriptionStatus, CancellationToken ct = default) => throw new NotImplementedException();
        public Task RemoveMember(Guid orgId, Guid userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Invitation>> GetInvitations(Guid orgId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Invitation?> CreateInvite(Guid orgId, string email, string role, CancellationToken ct = default) => throw new NotImplementedException();
        public Task RevokeInvite(Guid orgId, Guid invitationId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task AcceptInvite(string token, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Assignment>> GetAssignments(Guid orgId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task Assign(Guid orgId, Guid clientId, Guid practitionerId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task Reassign(Guid orgId, Guid assignmentId, Guid practitionerId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task UpdateAssignment(Guid orgId, Guid assignmentId, string? status, string? notes, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<GlobalUser>> GetGlobalUsers(CancellationToken ct = default) => throw new NotImplementedException();
        public Task UpdateGlobalUser(Guid userId, string? fullName, string? globalRole, string? subscriptionStatus, CancellationToken ct = default) => throw new NotImplementedException();
        public Task UpdateGlobalUserSubscription(Guid userId, string subscriptionStatus, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<PlatformOverview?> GetPlatformOverview(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<AuditLogEntry>> GetAuditLogs(Guid? organizationId = null, int limit = 200, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<RuntimeReadinessSnapshot?> GetRuntimeReadiness(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<System.Text.Json.JsonDocument?> GetClaudeUsage(int days = 30, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<System.Text.Json.JsonDocument?> GetClientActivity(int days = 30, int limit = 200, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<System.Text.Json.JsonDocument?> GetUserActivityDetail(Guid userId, int days = 90, CancellationToken ct = default) => throw new NotImplementedException();

        public Task<IReadOnlyList<KnowledgeRuleListItem>> GetKnowledgeRules(string? governanceStatus = null, string? key = null, CancellationToken ct = default)
            => throw new HttpRequestException("backend unavailable");

        public Task<KnowledgeRuleDetail?> GetKnowledgeRule(string ruleId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<KnowledgeRuleDetail?> ApproveKnowledgeRule(string ruleId, KnowledgeRuleApprovePayload payload, CancellationToken ct = default) => throw new NotImplementedException();
    }
}
