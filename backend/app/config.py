import os
from datetime import timedelta

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

INSECURE_SECRET_PLACEHOLDER = "troque-esta-chave-em-producao"


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./sistema_marcelo.db"
    ENV: str = "development"
    SECRET_KEY: str = INSECURE_SECRET_PLACEHOLDER
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:4201,http://127.0.0.1:4201"
    APP_NAME: str = "Sistema Marcelo"
    TIMEZONE: str = "America/Sao_Paulo"
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    RATE_LIMIT_DEFAULT: str = "120/minute"
    SEED_DEMO_DATA: bool = True

    def login_lockout_timedelta(self) -> timedelta:
        return timedelta(minutes=self.LOGIN_LOCKOUT_MINUTES)

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @property
    def is_production(self) -> bool:
        if self.ENV.lower() in ("production", "prod"):
            return True
        return os.environ.get("RENDER") == "true"

    def cors_origins_list(self) -> list[str]:
        raw = (self.CORS_ORIGINS or "*").strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.is_production and self.SECRET_KEY == INSECURE_SECRET_PLACEHOLDER:
            raise ValueError("SECRET_KEY deve ser definida em produção (ENV=production)")
        if self.is_production:
            self.SEED_DEMO_DATA = False
        return self

    class Config:
        env_file = ".env"


settings = Settings()
