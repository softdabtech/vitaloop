from app.config import Settings


def test_legacy_provider_environment_cannot_override_openai():
    settings = Settings(
        openai_api_key="openai-key",
        openai_base_url="https://api.openai.com/v1",
        openai_model="gpt-4o-mini",
        digitalocean_claude_api_key="legacy-do-key",
        routellm_api_key="legacy-route-key",
        abacus_ai_api_key="legacy-abacus-key",
    )

    assert settings.active_llm_api_key == "openai-key"
    assert settings.active_llm_base_url == "https://api.openai.com/v1"
    assert settings.active_llm_model == "gpt-4o-mini"
