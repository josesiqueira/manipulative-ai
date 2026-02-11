from functools import lru_cache
from pathlib import Path
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

# Find .env in project root (two levels up from this file)
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "sqlite+aiosqlite:///./societal_discussion.db"

    # OpenAI API
    openai_api_key: str = ""

    # Encryption
    encryption_secret: str = ""

    # Admin
    admin_password: str = "admin"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Application
    debug: bool = False

    model_config = ConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore frontend-only env vars like NEXT_PUBLIC_API_URL
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
