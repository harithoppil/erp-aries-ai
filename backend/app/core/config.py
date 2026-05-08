from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # App
    app_name: str = "Aries ERP"
    environment: str = "development"
    debug: bool = True

    # Database — Azure PostgreSQL (production & dev)
    # If DATABASE_URL uses postgresql:// (for Bun.SQL compat), auto-upgrade to +asyncpg
    database_url: str = "postgresql+asyncpg://postgres:Arieserp1!@aries-erp-ai.postgres.database.azure.com:5432/postgres"
    database_echo: bool = False

    @property
    def effective_database_url(self) -> str:
        """Ensure the URL uses the asyncpg driver for SQLAlchemy async engine.

        Bun.SQL uses postgresql://?sslmode=require, but asyncpg's connect()
        doesn't accept sslmode in the DSN. We strip it and use connect_args
        for SSL instead (handled in database.py).
        """
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Remove sslmode from query string — SSL is configured via connect_args in database.py
        if "?sslmode=" in url or "&sslmode=" in url:
            url = url.replace("?sslmode=require", "").replace("&sslmode=require", "")
        return url

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Vertex AI API key — for generation models (no location needed)
    # gemini-3-flash-preview, gemini-3.1-pro-preview,
    # gemini-3.1-flash-lite-preview, gemini-3.1-flash-image-preview,
    # gemini-3.1-flash-tts-preview
    google_cloud_api_key: str = ""  # GOOGLE_CLOUD_API_KEY

    # GCP service account — for embeddings + GCS
    # gemini-embedding-2 (multimodal: text + images) requires location='us'
    gcp_project_id: str = ""
    gca_key: str = ""  # Service account JSON from GCA_KEY env var
    gcs_bucket_name: str = "aries-raw-sources"

    # Wiki
    wiki_root: Path = Path(__file__).resolve().parents[3] / "wiki"

    # Azure (kept for user-facing integrations)
    azure_storage_connection_string: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_key: str = ""

    # API Key authentication — if empty, auth is skipped (development mode)
    api_key: str = ""

    # Legacy — kept in .env, not used for client creation
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"

    model_config = {"env_file": str(Path(__file__).resolve().parents[3] / ".env"), "env_file_encoding": "utf-8", "extra": "ignore"}

    def get_genai_client(self) -> "genai.Client":
        """Get a Gemini client for generation — Vertex AI API key, no location."""
        from google import genai

        if self.google_cloud_api_key:
            return genai.Client(vertexai=True, api_key=self.google_cloud_api_key)

        raise ValueError("Set GOOGLE_CLOUD_API_KEY for Vertex AI generation.")

    def get_embedding_client(self) -> "genai.Client":
        """Get a Gemini client for embeddings — Vertex AI with service account.

        gemini-embedding-2 (multimodal: text + images) uses location='us'.
        """
        from google import genai
        from google.oauth2 import service_account
        import json

        if self.gca_key:
            sa_info = json.loads(self.gca_key)
            credentials = service_account.Credentials.from_service_account_info(
                sa_info, scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            project = self.gcp_project_id or sa_info.get("project_id", "")
            return genai.Client(
                vertexai=True,
                project=project,
                location="us",
                credentials=credentials,
            )

        raise ValueError("Set GCA_KEY for Vertex AI embeddings.")


settings = Settings()
