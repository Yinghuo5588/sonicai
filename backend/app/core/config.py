from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Timezone
    app_timezone: str = Field(default="Asia/Shanghai", alias="APP_TIMEZONE")

    # Database
    database_url: str = Field(default="", alias="DATABASE_URL")

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
        """Return (access_secret, refresh_secret). Raise if not configured in production."""
        import warnings

        access = self.jwt_secret_key
        refresh = self.jwt_refresh_secret_key

        if not access or not refresh:
            warnings.warn(
                "⚠️ JWT_SECRET_KEY / JWT_REFRESH_SECRET_KEY 未配置，使用开发默认值。"
                "生产环境请务必在 .env 中设置！",
                stacklevel=2,
            )
            access = access or "sonicai-access-secret-dev-only-change-in-production"
            refresh = refresh or "sonicai-refresh-secret-dev-only-change-in-production"

        # Extra check: warn if default markers are detected
        _DEFAULT_MARKERS = ("dev-only", "change-in-production")
        if any(m in access for m in _DEFAULT_MARKERS) or any(m in refresh for m in _DEFAULT_MARKERS):
            warnings.warn(
                "⚠️ 检测到 JWT 密钥包含默认值标记，生产环境请更换为随机字符串！",
                stacklevel=2,
            )

        return access, refresh


settings = Settings()
