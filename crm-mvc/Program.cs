using Vitaloop.Crm.Web.Services.Contracts;
using Vitaloop.Crm.Web.Services.Auth;
using Vitaloop.Crm.Web.Services.Assignments;
using Vitaloop.Crm.Web.Services.Data;
using Vitaloop.Crm.Web.Services.Invitations;
using Vitaloop.Crm.Web.Services.Memberships;
using Vitaloop.Crm.Web.Services.Organizations;
using Vitaloop.Crm.Web.Services.Stubs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.AddHttpContextAccessor();
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));
builder.Services.Configure<CrmDataOptions>(builder.Configuration.GetSection(CrmDataOptions.SectionName));
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.Domain = ".vitaloop.today";
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Named HttpClient for backend API — timeout from config, defaulting to 30 s.
var crmDataSection = builder.Configuration.GetSection(CrmDataOptions.SectionName);
var backendTimeoutSeconds = crmDataSection.GetValue("TimeoutSeconds", 30);
builder.Services.AddHttpClient(nameof(HttpCrmDataGateway), client =>
{
    client.Timeout = TimeSpan.FromSeconds(backendTimeoutSeconds);
});

// Foundation stubs — replace with real implementations in subsequent migration waves.
builder.Services.AddScoped<IAuthService, StubAuthService>();
builder.Services.AddScoped<IUserContextService, StubUserContextService>();
builder.Services.AddScoped<IInvitationService, StubInvitationService>();

// Auth & Access layer (Step 3)
builder.Services.AddScoped<IUserContextDataSource, HttpUserContextDataSource>();
builder.Services.AddScoped<IUserContextAccessor, UserContextAccessor>();
builder.Services.AddScoped<IActiveOrganizationResolver, ActiveOrganizationResolver>();
builder.Services.AddScoped<IAccessPolicyService, AccessPolicyService>();
builder.Services.AddScoped<AuthRedirectService>();

// CRM data & domain services (Step 4)
builder.Services.AddScoped<ICrmDataGateway, HttpCrmDataGateway>();
builder.Services.AddScoped<OrganizationService>();
builder.Services.AddScoped<MembershipService>();
builder.Services.AddScoped<InvitationService>();
builder.Services.AddScoped<AssignmentService>();

builder.Services.AddHostedService<AuthStartupBlockersHostedService>();

var app = builder.Build();

app.UseForwardedHeaders();

if (app.Environment.IsProduction())
{
    app.Logger.LogInformation("CRM MVC started in Production");
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseStatusCodePagesWithReExecute("/error/{0}");
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.Use(async (context, next) =>
{
    var accessor = context.RequestServices.GetRequiredService<IUserContextAccessor>();
    var userContext = await accessor.GetCurrent(context.RequestAborted);
    context.Items["UserContext"] = userContext;
    await next();
});

app.UseAuthorization();

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Dashboard}/{action=Index}/{id?}");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

