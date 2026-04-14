using Vitaloop.Crm.Web.Models.Auth;

namespace Vitaloop.Crm.Web.Services.Contracts;

public interface IAccessPolicyService
{
    bool HasGlobalRole(UserContext userCtx, params string[] roles);
    bool HasOrgRole(UserContext userCtx, Guid orgId, params string[] roles);
    bool HasAnyAdminRole(UserContext userCtx);
    bool IsSubscriptionActive(UserContext userCtx);
    bool CanAccessOrg(UserContext userCtx, Guid orgId);
}
