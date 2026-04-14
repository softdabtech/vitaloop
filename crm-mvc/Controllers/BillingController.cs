using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;

namespace Vitaloop.Crm.Web.Controllers;

[Route("billing")]
[RequireSubscription]
public class BillingController : Controller
{
    [HttpGet("")]
    public IActionResult Index() => View();
}
