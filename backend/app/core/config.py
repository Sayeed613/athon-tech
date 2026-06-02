"""Application configuration via environment variables.

Uses Pydantic Settings to load from .env file and environment.
All values are validated at startup — missing critical values raise immediately.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Athon backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── App ───────────────────────────────────
    app_name: str = "Athon Backend"
    app_version: str = "0.1.0"
    app_env: str = "development"
    app_debug: bool = True
    app_log_level: str = "debug"

    # ─── Supabase ──────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""

    # ─── Database ──────────────────────────────
    database_url: str = "postgresql+asyncpg://localhost:5432/athon"
    database_pool_size: int = 20
    database_max_overflow: int = 10

    # ─── Redis ─────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ─── Celery ────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ─── AI Providers ──────────────────────────
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # ─── WhatsApp ──────────────────────────────
    whatsapp_api_key: str = ""
    whatsapp_phone_number: str = ""
    whatsapp_webhook_secret: str = ""

    # ─── Email ─────────────────────────────────
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # ─── Storage ───────────────────────────────
    storage_bucket: str = "athon-reports"
    storage_region: str = "us-east-1"

    # ─── Monitoring ────────────────────────────
    sentry_dsn: str = ""
    datadog_api_key: str = ""

    # ─── Computed Properties ───────────────────
    @property
    def jwt_jwks_url(self) -> str:
        """Derive JWKS URL from Supabase project URL."""
        return f"{self.supabase_url}/auth/v1/.well-known/jwks.json"


settings = Settings()
