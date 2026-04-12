from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""  # Project Settings → API → JWT Secret
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173"
    iherb_rcode: str = "VIT123"
    iherb_base_url: str = "https://www.iherb.com/search"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""  # Price ID for $49/mo plan

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
