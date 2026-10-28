using Microsoft.AspNetCore.Mvc;
using Vitaloop.Crm.Web.Attributes;

namespace Vitaloop.Crm.Web.Areas.Practitioner.Controllers;

[Area("Practitioner")]
[Route("practitioner")]
[RequireOrgRole("practitioner", "org_owner", "client_admin", "manager")]
public class DashboardController : Controller
{
    [HttpGet("")]
    public IActionResult Index()
    {
        return Redirect("/practitioner/clients");
    }
}
