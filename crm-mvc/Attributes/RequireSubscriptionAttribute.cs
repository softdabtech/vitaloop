using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Vitaloop.Crm.Web.Services.Contracts;

namespace Vitaloop.Crm.Web.Attributes;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequireSubscriptionAttribute : Attribute, IAsyncAuthorizationFilter
{
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

        if (!policy.IsSubscriptionActive(userCtx))
        {
            context.Result = new ObjectResult(new { detail = "Active subscription required", code = "SUBSCRIPTION_REQUIRED" })
            {
                StatusCode = StatusCodes.Status402PaymentRequired
            };
        }
    }
}
