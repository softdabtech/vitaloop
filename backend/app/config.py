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
    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173"
    iherb_rcode: str = "VIT123"
    iherb_base_url: str = "https://www.iherb.com/search"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""  # Price ID for $49/mo plan
    stripe_success_url: str = "http://localhost:5173/dashboard?sub=success"
    stripe_cancel_url: str = "http://localhost:5173/dashboard?sub=cancelled"
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "VITALOOP <noreply@vitaloop.today>"
    frontend_base_url: str = "https://vitaloop.today"
    crm_base_url: str = "https://crm.vitaloop.today"

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def active_abacus_ai_api_key(self) -> str:
        return self.abacus_ai_api_key or self.routellm_api_key

    @property
    def active_abacus_ai_base_url(self) -> str:
        return self.abacus_ai_base_url or self.routellm_base_url or "https://routellm.abacus.ai/v1"

    @property
    def active_abacus_ai_model(self) -> str:
        return self.abacus_ai_model or self.routellm_model or "route-llm"

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
