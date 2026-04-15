namespace Vitaloop.Crm.Web.Services.Auth;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public string FrontendLoginUrl { get; set; } = "https://vitaloop.today/login";
    public string TokenCookieName { get; set; } = "vo_access_token";
    public string ActiveOrganizationCookieName { get; set; } = "vo_active_org_id";
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string JwtSecret { get; set; } = string.Empty;
    public string JwtPublicKey { get; set; } = string.Empty;
    public string JwksUrl { get; set; } = "https://bfjxkzydonhwmafnyktt.supabase.co/auth/v1/.well-known/jwks.json";
}
