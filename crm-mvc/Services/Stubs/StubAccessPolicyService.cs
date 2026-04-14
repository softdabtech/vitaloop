using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Stubs;

public sealed class StubAccessPolicyService : IAccessPolicyService
{
    public bool HasGlobalRole(UserContext userCtx, params string[] roles)
    {
        return true;
    }

    public bool HasOrgRole(UserContext userCtx, Guid orgId, params string[] roles) => true;
    public bool HasAnyAdminRole(UserContext userCtx) => true;
    public bool IsSubscriptionActive(UserContext userCtx) => true;
    public bool CanAccessOrg(UserContext userCtx, Guid orgId) => true;
}
