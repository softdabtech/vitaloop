using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireOrgRoleAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string[] _roles;

    public RequireOrgRoleAttribute(params string[] roles)
    {
        _roles = roles ?? Array.Empty<string>();
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.Filters.Any(filter => filter is IAllowAnonymousFilter)
            || context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
        {
            return;
        }

        var accessor = context.HttpContext.RequestServices.GetRequiredService<IUserContextAccessor>();
        var policy = context.HttpContext.RequestServices.GetRequiredService<IAccessPolicyService>();
        var userCtx = await accessor.GetCurrent(context.HttpContext.RequestAborted);

        if (userCtx is null)
        {
            context.Result = new UnauthorizedObjectResult(new { detail = "Authentication required", code = "AUTH_REQUIRED" });
            return;
        }

        var orgId = userCtx.ActiveOrganizationId;
        if (!orgId.HasValue || !policy.HasOrgRole(userCtx, orgId.Value, _roles))
        {
            context.Result = new ObjectResult(new { detail = "Insufficient organization role", code = "ORG_ROLE_FORBIDDEN" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
