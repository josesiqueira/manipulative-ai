from functools import lru_cache
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "sqlite+aiosqlite:///./societal_discussion.db"

    # OpenAI API
    openai_api_key: str = ""

    # Admin
    admin_password: str = "admin"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Application
    debug: bool = False

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore frontend-only env vars like NEXT_PUBLIC_API_URL
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
