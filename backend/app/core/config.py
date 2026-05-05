"""Application settings."""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Aries Marine ERP"
    version: str = "0.3.0"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    database_url: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./aries_marine.db")
    database_echo: bool = False
    secret_key: str = os.getenv("SECRET_KEY", "aries-marine-erp-secret-key-change-in-production")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    google_cloud_api_key: str = os.getenv("GOOGLE_CLOUD_API_KEY", "")
    access_token_expire_hours: int = 24
    algorithm: str = "HS256"
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    class Config:
        env_file = ".env"

settings = Settings()
