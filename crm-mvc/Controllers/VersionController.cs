using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace Vitaloop.Crm.Web.Controllers;

/// <summary>
/// Exposes version and build metadata for deploy validation and diagnostics.
/// This endpoint is intentionally public (no auth required).
/// </summary>
[ApiController]
public class VersionController : ControllerBase
{
    private static readonly string _assemblyVersion =
        Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "unknown";

    private static readonly string _releaseVersion = ReadReleaseVersion();

    [HttpGet("/version")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult Get() => Ok(new
    {
        service = "vitaloop-crm",
        version = _assemblyVersion,
        release_version = _releaseVersion,
    });

    private static string ReadReleaseVersion()
    {
        try
        {
            // VERSION file lives at repo root. From the publish output directory
            // (/var/www/VITALOOP/crm-mvc/publish) it is two levels up.
            var candidates = new[]
            {
                Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "VERSION")),
                Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "VERSION")),
                "/var/www/VITALOOP/VERSION",
            };
            foreach (var path in candidates)
            {
                if (System.IO.File.Exists(path))
                    return System.IO.File.ReadAllText(path).Trim();
            }
        }
        catch
        {
            // Non-fatal — return unknown if the file is inaccessible.
        }
        return "unknown";
    }
}
