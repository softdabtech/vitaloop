from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""  # Legacy HS256 (leave empty if using ES256)
    supabase_jwt_public_key_jwk: str = ""  # ES256 EC public key as JWK JSON string
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    abacus_ai_api_key: str = ""
    abacus_ai_base_url: str = "https://routellm.abacus.ai/v1"
    abacus_ai_model: str = "route-llm"
    routellm_api_key: str = ""
    routellm_base_url: str = "https://routellm.abacus.ai/v1"
    routellm_model: str = "route-llm"
    # DigitalOcean Claude API (via Agents endpoint)
    digitalocean_claude_api_key: str = ""
    digitalocean_claude_base_url: str = "https://agents.do-ai.run"
    digitalocean_claude_model: str = "claude-3-5-sonnet"
    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173"
    security_enable_headers: bool = True
    rate_limit_backend: str = "inmemory"  # inmemory | redis
    rate_limit_trust_forwarded_for: bool = False
    rate_limit_forwarded_for_header: str = "x-forwarded-for"
    rate_limit_redis_url: str = ""
    rate_limit_redis_prefix: str = "rl"
    auth_rate_limit_per_minute: int = 60
    analyze_rate_limit_per_minute: int = 30
    protocol_rate_limit_per_minute: int = 30
    lab_upload_raw_retention_days: int = 180
    lab_upload_retention_batch_size: int = 500
    retention_alert_email: str = ""
    iherb_rcode: str = "VIT123"
    iherb_base_url: str = "https://www.iherb.com/search"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""  # Legacy fallback (same as stripe_price_id_personal)
    stripe_price_id_personal: str = ""  # Premium $19.99/mo
    stripe_price_id_practitioner: str = ""  # Practitioner Premium $29/mo
    stripe_success_url: str = "https://vitaloop.today/dashboard?sub=success"
    stripe_cancel_url: str = "https://vitaloop.today/dashboard?sub=cancelled"
    stripe_portal_return_url: str = "https://vitaloop.today/dashboard"
    freemium_upload_limit: int = 1  # free-tier lab uploads allowed before paywall
    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "VITALOOP <noreply@vitaloop.today>"
    registration_alert_email: str = "info@softdab.tech"
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1
    frontend_base_url: str = "https://vitaloop.today"
    crm_base_url: str = "https://crm.vitaloop.today"

    @property
    def origins_list(self) -> List[str]:
        parsed = [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

        # Keep critical frontend origins available even if env config is missing
        # or partially overwritten on a server. Only include localhost in development.
        fallback_origins = [
            "https://vitaloop.today",
            "https://www.vitaloop.today",
            "https://crm.vitaloop.today",
        ]

        # Add localhost only in development mode
        if self.app_env in ("development", "staging"):
            fallback_origins.extend([
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ])

        seen = set()
        merged: List[str] = []
        for origin in [*parsed, *fallback_origins]:
            if origin and origin not in seen:
                seen.add(origin)
                merged.append(origin)
        return merged

    @property
    def active_llm_api_key(self) -> str:
        """Active LLM API key. Priority: DigitalOcean Claude > RouteLLM > Anthropic"""
        return self.digitalocean_claude_api_key or self.routellm_api_key or self.abacus_ai_api_key

    @property
    def active_llm_base_url(self) -> str:
        """Active LLM base URL. Priority: DigitalOcean Claude > RouteLLM > Anthropic"""
        if self.digitalocean_claude_api_key:
            return self.digitalocean_claude_base_url
        return self.routellm_base_url or self.abacus_ai_base_url or "https://routellm.abacus.ai/v1"

    @property
    def active_llm_model(self) -> str:
        """Active LLM model. Priority: DigitalOcean Claude > RouteLLM > Anthropic"""
        if self.digitalocean_claude_api_key:
            return self.digitalocean_claude_model
        return self.routellm_model or self.abacus_ai_model or "route-llm"

    # Backward-compatible aliases (deprecated — use active_llm_* instead)
    @property
    def active_abacus_ai_api_key(self) -> str:
        return self.active_llm_api_key

    @property
    def active_abacus_ai_base_url(self) -> str:
        return self.active_llm_base_url

    @property
    def active_abacus_ai_model(self) -> str:
        return self.active_llm_model

    @property
    def active_supabase_service_key(self) -> str:
        """Prefer service role key; keep legacy key as fallback during migration."""
        return self.supabase_service_role_key or self.supabase_service_key

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
