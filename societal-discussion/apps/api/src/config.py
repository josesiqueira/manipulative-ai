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

    # Participant access code — used to be required to start a conversation,
    # currently unused while the participant URL is open to the public for
    # HEPP demo. Kept here so re-enabling the gate is a one-line change.
    participant_password: str = ""

    # When set, every participant conversation is forced to this party
    # (overrides the normal no-repeat random assignment). Used during the
    # HEPP demo to point all traffic at a single party. Empty = normal
    # weighted-random assignment across all 9 parties.
    forced_party: str = ""

    # CORS
    # Next.js admin (3000), Astro participant app dev (4321) and preview (8080).
    cors_origins: str = "http://localhost:3000,http://localhost:4321,http://127.0.0.1:4321,http://localhost:8080,http://127.0.0.1:8080"

    # Speech. Remote engines are OpenAI-compatible servers on the
    # university cluster; when a URL is empty the local engine in this
    # container is used (faster-whisper small, Piper). Audio is never stored.
    speech_stt_url: str = ""            # e.g. http://speaches:8000 (POST /v1/audio/transcriptions)
    speech_stt_model: str = "Systran/faster-whisper-large-v3-turbo"
    speech_tts_url: str = ""            # e.g. http://voxcpm:8000 (POST /v1/audio/speech)
    speech_tts_model: str = "voxcpm2"
    speech_tts_voice: str = "default"
    speech_tts_send_language: bool = False  # add a "language" field to /v1/audio/speech
    speech_api_key: str = ""            # bearer token for the remote servers, if any
    speech_models_dir: str = "models"   # Piper voices and the whisper model directory
    speech_local_whisper_model: str = "small"   # size name (downloaded) or a directory under models_dir
    speech_local_whisper_compute: str = "int8"
    speech_local_whisper_threads: int = 0       # CTranslate2 threads; 0 = its default (4)
    speech_max_waiting: int = 12        # per engine and worker process; more waiting jobs get a fast 503
    speech_warm_up: bool = False        # load and run the local engines at start
    # Speech pods have no database: they ask the API whether a conversation
    # is open (GET {url}/api/conversations/{id}). Empty = check the database.
    speech_conversation_check_url: str = ""
    speech_max_upload_bytes: int = 2_000_000
    speech_max_text_chars: int = 600

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
