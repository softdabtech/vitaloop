using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireGlobalRoleAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string[] _roles;

    public RequireGlobalRoleAttribute(params string[] roles)
    {
        _roles = roles ?? Array.Empty<string>();
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var accessor = context.HttpContext.RequestServices.GetRequiredService<IUserContextAccessor>();
        var policy = context.HttpContext.RequestServices.GetRequiredService<IAccessPolicyService>();
        var userCtx = await accessor.GetCurrent(context.HttpContext.RequestAborted);

        if (userCtx is null)
        {
            context.Result = new UnauthorizedObjectResult(new { detail = "Authentication required", code = "AUTH_REQUIRED" });
            return;
        }

        if (!policy.HasGlobalRole(userCtx, _roles))
        {
            context.Result = new ObjectResult(new { detail = "Insufficient global role", code = "ROLE_FORBIDDEN" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
