using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;

namespace Vitaloop.Crm.Web.Areas.Admin.Controllers;

[Area("Admin")]
[Route("admin")]
[RequireOrgRole("org_owner", "client_admin")]
public class DashboardController : Controller
{
    [HttpGet("")]
    public IActionResult Index() => View();
}
