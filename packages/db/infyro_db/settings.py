from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://infyro:infyro@127.0.0.1:5432/infyro"
    jwt_secret: str = "change-me"
    jwt_access_ttl_seconds: int = 3600
    jwt_refresh_ttl_seconds: int = 604800
    fernet_key: str = ""
    telegram_bot_token: str = ""
    telegram_bot_username: str = "InfyroBot"
    telegram_webhook_secret: str = ""
    telegram_ingress: str = "hermes"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    alpha_vantage_api_key: str = ""
    # When true, POST /auth/dev-login is available (local / MVP only).
    infyro_dev_mode: bool = False
    # Optional MVP fallback if an agent has no BYOK key stored yet.
    groq_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    # Chat model IDs (override via env for production).
    groq_chat_model: str = "llama-3.3-70b-versatile"
    openai_chat_model: str = "gpt-4o-mini"


@lru_cache
def get_settings() -> Settings:
    return Settings()
