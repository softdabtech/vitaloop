using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Vitaloop.Crm.Web.Controllers;

public class HomeController : Controller
{
    [HttpGet("/")]
    public IActionResult Index()
    {
        return RedirectToAction("Index", "Dashboard", new { area = "Admin" });
    }

    [HttpGet("/health")]
    public IActionResult Health()
    {
        return Json(new { status = "ok", app = "vitaloop-crm" });
    }

    [HttpGet("/error")]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        var exceptionFeature = HttpContext.Features.Get<IExceptionHandlerPathFeature>();
        ViewData["OriginalPath"] = exceptionFeature?.Path ?? "/";
        return View();
    }

    [HttpGet("/error/{statusCode:int}")]
    public IActionResult StatusCodeError(int statusCode)
    {
        ViewData["StatusCode"] = statusCode;
        return View();
    }
}

