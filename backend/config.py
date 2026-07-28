from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path

ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    openai_api_key: str
    brave_api_key: str = ""
    # Comma-separated list of allowed origins, e.g. "https://pilotphd.vercel.app,https://www.pilotphd.com"
    frontend_url: str = "http://localhost:3000"
    secret_key: str
    resend_api_key: str
    from_email: str = "onboarding@resend.dev"
    environment: str = "development"

    # gpt-5.6 is the flagship alias; -terra balances cost and intelligence,
    # -luna is the budget tier.
    openai_model: str = "gpt-5.6-terra"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]

    @property
    def frontend_base_url(self) -> str:
        """Single origin to build links in emails from.

        frontend_url is a comma-separated CORS allowlist, so interpolating it
        directly yields a malformed URL as soon as more than one origin is set.
        """
        origins = self.cors_origins
        return origins[0] if origins else "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
