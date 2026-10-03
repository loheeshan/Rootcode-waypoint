from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    app_name: str = "waypoint-api"
    app_env: str = "development"
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "waypoint"
    postgres_user: str = "waypoint"
    postgres_password: str = ""
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    jwt_secret_key: SecretStr | None = None
    jwt_issuer: str = Field(default="waypoint-api", min_length=1)
    jwt_audience: str = Field(default="waypoint-clients", min_length=1)
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)


@lru_cache
def get_settings() -> Settings:
    return Settings()
