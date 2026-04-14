using Microsoft.AspNetCore.Mvc;

namespace Vitaloop.Crm.Web.Controllers;

[Route("settings")]
public class SettingsController : Controller
{
    [HttpGet("")]
    public IActionResult Index() => View();
}
