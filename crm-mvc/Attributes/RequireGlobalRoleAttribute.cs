using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Vitaloop.Crm.Web.Services.Contracts;
using System.Net;

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

        static bool IsPageNavigationRequest(HttpRequest request) => HttpMethods.IsGet(request.Method);

        static string BuildLoginRedirect(HttpRequest request)
        {
            var fullPath = string.Concat(request.PathBase, request.Path, request.QueryString.ToUriComponent());
            var encoded = WebUtility.UrlEncode(fullPath);
            return $"/auth/login?returnUrl={encoded}";
        }

        if (userCtx is null)
        {
            if (IsPageNavigationRequest(context.HttpContext.Request))
            {
                context.Result = new RedirectResult(BuildLoginRedirect(context.HttpContext.Request));
                return;
            }

            context.Result = new UnauthorizedObjectResult(new { detail = "Authentication required", code = "AUTH_REQUIRED" });
            return;
        }

        if (!policy.HasGlobalRole(userCtx, _roles))
        {
            if (IsPageNavigationRequest(context.HttpContext.Request))
            {
                context.Result = new RedirectResult("/auth/post-login");
                return;
            }

            context.Result = new ObjectResult(new { detail = "Insufficient global role", code = "ROLE_FORBIDDEN" })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
        }
    }
}
