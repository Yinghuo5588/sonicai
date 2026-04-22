from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Timezone
    app_timezone: str = Field(default="Asia/Shanghai", alias="APP_TIMEZONE")

    # Database
    database_url: str = Field(default="", alias="DATABASE_URL")

    # Redis
    redis_url: str = Field(default="", alias="REDIS_URL")
    redis_key_prefix: str = Field(default="sonicai:", alias="REDIS_KEY_PREFIX")

    # Initial admin (created on first start if no users exist)
    init_admin_username: str = Field(default="admin", alias="INIT_ADMIN_USERNAME")
    init_admin_password: str = Field(default="change_me", alias="INIT_ADMIN_PASSWORD")
    init_admin_email: str = Field(default="admin@example.com", alias="INIT_ADMIN_EMAIL")

    # JWT
    jwt_secret_key: str = Field(default="", alias="JWT_SECRET_KEY")
    jwt_refresh_secret_key: str = Field(default="", alias="JWT_REFRESH_SECRET_KEY")
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # CORS
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")

    class Config:
        env_file = ".env"
        extra = "ignore"

    def get_jwt_secrets(self) -> tuple[str, str]:
        """Return (access_secret, refresh_secret), generating defaults if empty."""
        access = self.jwt_secret_key or "sonicai-access-secret-dev-only-change-in-production"
        refresh = self.jwt_refresh_secret_key or "sonicai-refresh-secret-dev-only-change-in-production"
        return access, refresh


settings = Settings()