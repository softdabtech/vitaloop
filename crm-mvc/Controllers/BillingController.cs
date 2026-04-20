using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;
using Vitaloop.Crm.Web.Services.Auth;
using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Data;
using Vitaloop.Crm.Web.ViewModels;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace Vitaloop.Crm.Web.Controllers;

[Route("billing")]
[RequireSubscription]
public class BillingController : Controller
{
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly CrmDataOptions _crmOptions;
    private readonly AuthOptions _authOptions;

    public BillingController(
        IUserContextAccessor userContextAccessor,
        IHttpClientFactory httpClientFactory,
        IOptions<CrmDataOptions> crmOptions,
        IOptions<AuthOptions> authOptions)
    {
        _userContextAccessor = userContextAccessor;
        _httpClientFactory = httpClientFactory;
        _crmOptions = crmOptions.Value;
        _authOptions = authOptions.Value;
    }

    [HttpGet("")]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var userCtx = await _userContextAccessor.GetCurrent(ct);

        var model = new BillingPageViewModel
        {
            SubscriptionStatus = userCtx?.SubscriptionStatus ?? "free",
            CurrentPlan = string.Equals(userCtx?.GlobalRole, "practitioner", StringComparison.OrdinalIgnoreCase)
                ? "practitioner"
                : "personal",
            StripeReady = true,
        };

        return View(model);
    }

    [HttpPost("checkout")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Checkout([FromForm] string planId, CancellationToken ct)
    {
        var plan = string.Equals(planId, "practitioner", StringComparison.OrdinalIgnoreCase)
            ? "practitioner"
            : "personal";

        var token = Request.Cookies.TryGetValue(_authOptions.TokenCookieName, out var cookieToken)
            ? cookieToken
            : null;
        if (string.IsNullOrWhiteSpace(token))
        {
            TempData["ErrorMessage"] = "Session expired. Please log in again.";
            return RedirectToAction(nameof(Index));
        }

        var client = _httpClientFactory.CreateClient(nameof(HttpCrmDataGateway));
        var checkoutUrl = new Uri(new Uri(_crmOptions.BaseUrl.TrimEnd('/') + "/"), "stripe/checkout");

        var request = new HttpRequestMessage(HttpMethod.Post, checkoutUrl)
        {
            Content = JsonContent.Create(new { plan_id = plan })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            TempData["ErrorMessage"] = "Billing checkout is not available right now.";
            return RedirectToAction(nameof(Index));
        }

        var payload = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>(cancellationToken: ct);
        if (payload is null || !payload.TryGetValue("checkout_url", out var redirectUrl) || string.IsNullOrWhiteSpace(redirectUrl))
        {
            TempData["ErrorMessage"] = "Billing checkout response is invalid.";
            return RedirectToAction(nameof(Index));
        }

        return Redirect(redirectUrl);
    }
}
