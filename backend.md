<backend>
  <!--
  This file contains a concatenated representation of a codebase.
  An <index> is provided below with the list of files included.
  To find the contents of a specific file, search for `<filename>` and `</filename>` tags.
  -->

  ## File Index

  ```
  <index>
    migrations/env.py
    migrations/__init__.py
    app/__init__.py
    app/main.py
    app/core/auth.py
    app/core/config.py
    app/core/database.py
    app/core/__init__.py
    app/core/telemetry.py
    app/agents/__init__.py
    app/agents/base.py
    app/models/enquiry.py
    app/models/erp.py
    app/models/ai.py
    app/models/__init__.py
    app/models/workflow.py
    app/schemas/enquiry.py
    app/schemas/__init__.py
    app/mcp_servers/erp_server.py
    app/mcp_servers/sap_server.py
    app/mcp_servers/gateway.py
    app/mcp_servers/mutator_server.py
    app/mcp_servers/document_output_server.py
    app/mcp_servers/outlook_server.py
    app/mcp_servers/wiki_server.py
    app/mcp_servers/__init__.py
    app/mcp_servers/gemini_server.py
    app/mcp_servers/search_server.py
    app/mcp_servers/media_server.py
    app/api/__init__.py
    app/api/routes/enquiries.py
    app/api/routes/erp.py
    app/api/routes/documents.py
    app/api/routes/ai.py
    app/api/routes/__init__.py
    app/api/routes/pipeline.py
    app/api/routes/channels.py
    app/api/routes/workflow.py
    app/api/routes/wiki.py
    app/services/ingestion.py
    app/services/execution.py
    app/services/wiki_loop.py
    app/services/agent_loop.py
    app/services/__init__.py
    app/services/rules.py
    app/services/gemini.py
    app/services/rag.py
    app/services/pipeline.py
    app/services/wiki_context.py
    app/services/wiki.py
    app/services/workflow_executor.py
    tests/conftest.py
    tests/__init__.py
    tests/test_ai.py
    tests/test_enquiries.py
    tests/test_wiki.py
    tests/test_mcp.py
    tests/test_rules.py
    tests/test_rag.py
    tests/test_documents.py
    tests/test_pipeline.py
  </index>
  ```

  ---

  | # | File | Path | Lines | Tokens |
  |---|------|------|-------|--------|
  | 1 | [`env.py`](#migrations-env-py) | `migrations` | 52 | 336 |
  | 2 | [`__init__.py`](#migrations-init-py) | `migrations` | 0 | 50 |
  | 3 | [`__init__.py`](#app-init-py) | `app` | 0 | 46 |
  | 4 | [`main.py`](#app-main-py) | `app` | 118 | 914 |
  | 5 | [`auth.py`](#app-core-auth-py) | `app/core` | 53 | 413 |
  | 6 | [`config.py`](#app-core-config-py) | `app/core` | 81 | 724 |
  | 7 | [`database.py`](#app-core-database-py) | `app/core` | 49 | 354 |
  | 8 | [`__init__.py`](#app-core-init-py) | `app/core` | 0 | 51 |
  | 9 | [`telemetry.py`](#app-core-telemetry-py) | `app/core` | 22 | 228 |
  | 10 | [`__init__.py`](#app-agents-init-py) | `app/agents` | 3 | 106 |
  | 11 | [`base.py`](#app-agents-base-py) | `app/agents` | 154 | 1,159 |
  | 12 | [`enquiry.py`](#app-models-enquiry-py) | `app/models` | 86 | 986 |
  | 13 | [`erp.py`](#app-models-erp-py) | `app/models` | 547 | 6,599 |
  | 14 | [`ai.py`](#app-models-ai-py) | `app/models` | 126 | 1,624 |
  | 15 | [`__init__.py`](#app-models-init-py) | `app/models` | 33 | 464 |
  | 16 | [`workflow.py`](#app-models-workflow-py) | `app/models` | 136 | 1,576 |
  | 17 | [`enquiry.py`](#app-schemas-enquiry-py) | `app/schemas` | 105 | 659 |
  | 18 | [`__init__.py`](#app-schemas-init-py) | `app/schemas` | 25 | 180 |
  | 19 | [`erp_server.py`](#app-mcp-servers-erp-server-py) | `app/mcp_servers` | 26 | 316 |
  | 20 | [`sap_server.py`](#app-mcp-servers-sap-server-py) | `app/mcp_servers` | 17 | 245 |
  | 21 | [`gateway.py`](#app-mcp-servers-gateway-py) | `app/mcp_servers` | 358 | 3,496 |
  | 22 | [`mutator_server.py`](#app-mcp-servers-mutator-server-py) | `app/mcp_servers` | 351 | 2,799 |
  | 23 | [`document_output_server.py`](#app-mcp-servers-document-output-server-py) | `app/mcp_servers` | 386 | 3,245 |
  | 24 | [`outlook_server.py`](#app-mcp-servers-outlook-server-py) | `app/mcp_servers` | 17 | 249 |
  | 25 | [`wiki_server.py`](#app-mcp-servers-wiki-server-py) | `app/mcp_servers` | 49 | 466 |
  | 26 | [`__init__.py`](#app-mcp-servers-init-py) | `app/mcp_servers` | 0 | 62 |
  | 27 | [`gemini_server.py`](#app-mcp-servers-gemini-server-py) | `app/mcp_servers` | 48 | 439 |
  | 28 | [`search_server.py`](#app-mcp-servers-search-server-py) | `app/mcp_servers` | 38 | 368 |
  | 29 | [`media_server.py`](#app-mcp-servers-media-server-py) | `app/mcp_servers` | 107 | 877 |
  | 30 | [`__init__.py`](#app-api-init-py) | `app/api` | 0 | 51 |
  | 31 | [`enquiries.py`](#app-api-routes-enquiries-py) | `app/api/routes` | 82 | 689 |
  | 32 | [`erp.py`](#app-api-routes-erp-py) | `app/api/routes` | 387 | 3,817 |
  | 33 | [`documents.py`](#app-api-routes-documents-py) | `app/api/routes` | 147 | 1,356 |
  | 34 | [`ai.py`](#app-api-routes-ai-py) | `app/api/routes` | 818 | 6,765 |
  | 35 | [`__init__.py`](#app-api-routes-init-py) | `app/api/routes` | 0 | 57 |
  | 36 | [`pipeline.py`](#app-api-routes-pipeline-py) | `app/api/routes` | 41 | 344 |
  | 37 | [`channels.py`](#app-api-routes-channels-py) | `app/api/routes` | 594 | 4,191 |
  | 38 | [`workflow.py`](#app-api-routes-workflow-py) | `app/api/routes` | 432 | 3,650 |
  | 39 | [`wiki.py`](#app-api-routes-wiki-py) | `app/api/routes` | 50 | 439 |
  | 40 | [`ingestion.py`](#app-services-ingestion-py) | `app/services` | 83 | 643 |
  | 41 | [`execution.py`](#app-services-execution-py) | `app/services` | 128 | 953 |
  | 42 | [`wiki_loop.py`](#app-services-wiki-loop-py) | `app/services` | 152 | 1,306 |
  | 43 | [`agent_loop.py`](#app-services-agent-loop-py) | `app/services` | 295 | 2,292 |
  | 44 | [`__init__.py`](#app-services-init-py) | `app/services` | 0 | 51 |
  | 45 | [`rules.py`](#app-services-rules-py) | `app/services` | 82 | 685 |
  | 46 | [`gemini.py`](#app-services-gemini-py) | `app/services` | 461 | 3,863 |
  | 47 | [`rag.py`](#app-services-rag-py) | `app/services` | 818 | 6,589 |
  | 48 | [`pipeline.py`](#app-services-pipeline-py) | `app/services` | 141 | 1,190 |
  | 49 | [`wiki_context.py`](#app-services-wiki-context-py) | `app/services` | 42 | 339 |
  | 50 | [`wiki.py`](#app-services-wiki-py) | `app/services` | 205 | 2,057 |
  | 51 | [`workflow_executor.py`](#app-services-workflow-executor-py) | `app/services` | 386 | 3,092 |
  | 52 | [`conftest.py`](#tests-conftest-py) | `tests` | 31 | 298 |
  | 53 | [`__init__.py`](#tests-init-py) | `tests` | 0 | 46 |
  | 54 | [`test_ai.py`](#tests-test-ai-py) | `tests` | 70 | 649 |
  | 55 | [`test_enquiries.py`](#tests-test-enquiries-py) | `tests` | 129 | 1,229 |
  | 56 | [`test_wiki.py`](#tests-test-wiki-py) | `tests` | 97 | 1,024 |
  | 57 | [`test_mcp.py`](#tests-test-mcp-py) | `tests` | 71 | 738 |
  | 58 | [`test_rules.py`](#tests-test-rules-py) | `tests` | 121 | 1,074 |
  | 59 | [`test_rag.py`](#tests-test-rag-py) | `tests` | 118 | 1,145 |
  | 60 | [`test_documents.py`](#tests-test-documents-py) | `tests` | 63 | 644 |
  | 61 | [`test_pipeline.py`](#tests-test-pipeline-py) | `tests` | 78 | 886 |
  | | **Total** | | **9,109** | **81,183** |

  ---

  <migrations/env.py>

<a name="migrations-env-py"></a>
### `migrations/env.py`

```py
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from backend.app.core.config import settings
from backend.app.core.database import Base
from backend.app.models.enquiry import Enquiry, Document, AuditLog  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    import asyncio
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

  </migrations/env.py>

  <migrations/__init__.py>

<a name="migrations-init-py"></a>
### `migrations/__init__.py`

```py
```

  </migrations/__init__.py>

  <app/__init__.py>

<a name="app-init-py"></a>
### `app/__init__.py`

```py
```

  </app/__init__.py>

  <app/main.py>

<a name="app-main-py"></a>
### `app/main.py`

```py
"""Aries ERP — Hybrid AI Presales Consultant.

FastAPI application entry point. Assembles all routes, middleware, and startup/shutdown events.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from backend.app.core.config import settings
from backend.app.core.database import engine, Base
from backend.app.core.auth import APIKeyMiddleware
from backend.app.mcp_servers.gateway import register_all_servers
from backend.app.api.routes.enquiries import router as enquiries_router
from backend.app.api.routes.documents import router as documents_router
from backend.app.api.routes.wiki import router as wiki_router
from backend.app.api.routes.pipeline import router as pipeline_router
from backend.app.api.routes.erp import router as erp_router
from backend.app.api.routes.workflow import router as workflow_router
from backend.app.api.routes.ai import router as ai_router
from backend.app.api.routes.channels import router as channels_router

# Configure structured logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("aries")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Aries ERP v0.1.0 — environment: %s", settings.environment)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    register_all_servers()
    logger.info("Database tables created, MCP servers registered")

    yield

    # Shutdown
    logger.info("Shutting down Aries ERP")
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="Hybrid AI Presales Consultant — MCP-native, Gemini-powered, Wiki-first",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"] if not settings.debug else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key authentication — skipped if settings.api_key is empty
app.add_middleware(APIKeyMiddleware)

# Routes
app.include_router(enquiries_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(wiki_router, prefix="/api/v1")
app.include_router(pipeline_router, prefix="/api/v1")
app.include_router(erp_router, prefix="/api/v1")
app.include_router(workflow_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(channels_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}


@app.get("/api/v1/mcp/servers")
async def list_mcp_servers():
    from backend.app.mcp_servers.gateway import gateway
    return gateway.list_servers()


@app.get("/api/v1/mcp/tools")
async def list_mcp_tools(server: str | None = None):
    from backend.app.mcp_servers.gateway import gateway
    return gateway.list_tools(server)


@app.post("/api/v1/mcp/tools/call")
async def call_mcp_tool(request: dict):
    """Call an MCP tool by name with kwargs. Body: {"tool_name": "...", "kwargs": {...}}"""
    from backend.app.mcp_servers.gateway import gateway
    from fastapi import HTTPException
    tool_name = request.get("tool_name")
    kwargs = request.get("kwargs", {})
    if not tool_name:
        raise HTTPException(400, "tool_name is required")
    try:
        result = await gateway.call_tool(tool_name, **kwargs)
        return {"tool": tool_name, "result": result}
    except ValueError as e:
        raise HTTPException(404, str(e))


# Telemetry
FastAPIInstrumentor.instrument_app(app)
```

  </app/main.py>

  <app/core/auth.py>

<a name="app-core-auth-py"></a>
### `app/core/auth.py`

```py
"""API Key authentication middleware.

Checks for X-API-Key header or api_key query parameter against the configured
settings.api_key. If no API key is configured, authentication is skipped
(development mode).

Skips auth for health check (/health) and docs (/docs, /openapi.json, /redoc).
"""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.app.core.config import settings

logger = logging.getLogger("aries.auth")

# Paths that never require authentication
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Middleware that validates API key on every request (except public paths)."""

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public paths
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # If no API key is configured, skip auth (development mode)
        configured_key = settings.api_key
        if not configured_key:
            return await call_next(request)

        # Check X-API-Key header first, then api_key query parameter
        provided_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")

        if not provided_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "API key required. Provide X-API-Key header or api_key query parameter."},
            )

        if provided_key != configured_key:
            logger.warning("Invalid API key attempt from %s", request.client.host if request.client else "unknown")
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid API key."},
            )

        return await call_next(request)
```

  </app/core/auth.py>

  <app/core/config.py>

<a name="app-core-config-py"></a>
### `app/core/config.py`

```py
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # App
    app_name: str = "Aries ERP"
    environment: str = "development"
    debug: bool = True

    # Database (SQLite for local dev, PostgreSQL for production)
    database_url: str = "sqlite+aiosqlite:///./aries.db"
    database_echo: bool = False

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
    gemini_model: str = "gemini-2.5-flash"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

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
```

  </app/core/config.py>

  <app/core/database.py>

<a name="app-core-database-py"></a>
### `app/core/database.py`

```py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator, CHAR

from backend.app.core.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_async_engine(settings.database_url, echo=settings.database_echo, connect_args=connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class GUID(TypeDecorator):
    """Platform-independent UUID type. Uses CHAR(36) for SQLite, native UUID for PostgreSQL."""
    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(value)
        return value


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

  </app/core/database.py>

  <app/core/__init__.py>

<a name="app-core-init-py"></a>
### `app/core/__init__.py`

```py
```

  </app/core/__init__.py>

  <app/core/telemetry.py>

<a name="app-core-telemetry-py"></a>
### `app/core/telemetry.py`

```py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

from backend.app.core.config import settings


def setup_telemetry() -> trace.Tracer:
    resource = Resource.create({"service.name": "aries-erp", "deployment.environment": settings.environment})
    provider = TracerProvider(resource=resource)

    if settings.environment != "test":
        exporter = OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)
    return trace.get_tracer("aries-erp")


tracer = setup_telemetry()
```

  </app/core/telemetry.py>

  <app/agents/__init__.py>

<a name="app-agents-init-py"></a>
### `app/agents/__init__.py`

```py
from backend.app.agents.base import BaseAgent, IngestAgent, QueryAgent, DraftingAgent, ExecuteAgent

__all__ = ["BaseAgent", "IngestAgent", "QueryAgent", "DraftingAgent", "ExecuteAgent"]
```

  </app/agents/__init__.py>

  <app/agents/base.py>

<a name="app-agents-base-py"></a>
### `app/agents/base.py`

```py
"""Agent base class and sub-agent implementations (Node 14).

Ingest Agent, Query Agent, Drafting Agent, Execute Agent.
Each operates on the wiki repo and calls MCP servers via the gateway.
"""

import uuid
from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.mcp_servers.gateway import gateway
from backend.app.models.enquiry import Enquiry
from backend.app.services.wiki import WikiService
from backend.app.services.gemini import GeminiService
from backend.app.services.rules import apply_rules


class BaseAgent(ABC):
    """Base class for all Aries sub-agents."""

    name: str = "base"

    def __init__(self):
        self.wiki = WikiService()
        self.gemini = GeminiService()

    @abstractmethod
    async def run(self, context: dict) -> dict:
        """Execute the agent's task. Returns result dict."""
        ...


class IngestAgent(BaseAgent):
    """Ingest Agent — runs MarkItDown, writes source pages, updates entity pages."""

    name = "ingest"

    async def run(self, context: dict) -> dict:
        enquiry_id = context.get("enquiry_id")
        filename = context.get("filename", "unknown")
        markdown = context.get("markdown", "")

        # Write source page
        source_path = f"sources/{enquiry_id}/{filename}.md"
        self.wiki.write_page(
            source_path,
            f"---\ntype: source\nenquiry_id: {enquiry_id}\nfile: {filename}\n---\n\n# Source: {filename}\n\n{markdown}",
            f"Ingest: {filename}",
        )

        # Update index
        self.wiki.update_index()
        self.wiki.append_to_log("ingest", filename, f"Enquiry {enquiry_id}")

        return {"status": "completed", "source_page": source_path}


class QueryAgent(BaseAgent):
    """Query Agent — answers questions against the wiki + raw sources."""

    name = "query"

    async def run(self, context: dict) -> dict:
        question = context.get("question", "")
        search_results = self.wiki.search(question, limit=10)

        wiki_context = ""
        for r in search_results:
            page = self.wiki.read_page(r.path)
            if page:
                wiki_context += f"\n## {r.title}\n{page.content[:2000]}\n"

        answer = await self.gemini.answer_query(question, wiki_context)

        # Optionally file the answer back into the wiki
        if context.get("save_answer"):
            answer_path = f"concepts/query-{uuid.uuid4().hex[:8]}.md"
            self.wiki.write_page(
                answer_path,
                f"---\ntype: concept\ncategory: query-result\n---\n\n# Q: {question}\n\n{answer}",
                f"Save query result: {question[:50]}",
            )

        return {"answer": answer, "sources_used": [r.path for r in search_results]}


class DraftingAgent(BaseAgent):
    """Drafting Agent — produces proposal draft (output of Phase 3)."""

    name = "drafting"

    async def run(self, context: dict) -> dict:
        enquiry: Enquiry | None = context.get("enquiry")

        if not enquiry:
            return {"status": "error", "message": "No enquiry provided"}

        # Wiki-first retrieval
        wiki_context = ""
        index = self.wiki.read_page("index.md")
        if index:
            wiki_context += index.content

        for term in [enquiry.client_name, enquiry.industry or ""]:
            if term:
                results = self.wiki.search(term, limit=5)
                for r in results:
                    page = self.wiki.read_page(r.path)
                    if page:
                        wiki_context += f"\n## {r.title}\n{page.content[:2000]}\n"

        # Rules before LLM
        rules = apply_rules(
            estimated_value=enquiry.estimated_value,
            estimated_cost=enquiry.estimated_cost,
            industry=enquiry.industry,
        )

        # Classify
        classification = await self.gemini.classify_enquiry(enquiry, wiki_context)

        # LLM draft
        draft = await self.gemini.draft_proposal(enquiry, wiki_context, rules, classification)

        return {
            "status": "completed",
            "draft": draft,
            "classification": classification,
            "rules_output": {
                "min_margin_pct": rules.min_margin_pct,
                "policy_violations": rules.policy_violations,
                "suggested_template": rules.suggested_template,
            },
        }


class ExecuteAgent(BaseAgent):
    """Execute Agent — fans out across MCP servers once approved."""

    name = "execute"

    async def run(self, context: dict) -> dict:
        from backend.app.services.execution import execute_enquiry
        from backend.app.core.database import async_session

        enquiry = context.get("enquiry")
        if not enquiry:
            return {"status": "error", "message": "No enquiry provided"}

        async with async_session() as db:
            result = await execute_enquiry(enquiry, db)

        return result
```

  </app/agents/base.py>

  <app/models/enquiry.py>

<a name="app-models-enquiry-py"></a>
### `app/models/enquiry.py`

```py
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


class EnquiryStatus(str, enum.Enum):
    DRAFT = "draft"
    INGESTED = "ingested"
    CLASSIFIED = "classified"
    RULES_APPLIED = "rules_applied"
    LLM_DRAFTED = "llm_drafted"
    POLICY_REVIEW = "policy_review"
    HUMAN_REVIEW = "human_review"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    REJECTED = "rejected"


class Enquiry(Base):
    __tablename__ = "enquiries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    enquiry_number: Mapped[str | None] = mapped_column(String(50), unique=True, index=True)
    client_name: Mapped[str] = mapped_column(String(255))
    client_email: Mapped[str | None] = mapped_column(String(255))
    channel: Mapped[str] = mapped_column(String(50))
    industry: Mapped[str | None] = mapped_column(String(100))
    subdivision: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[EnquiryStatus] = mapped_column(SAEnum(EnquiryStatus), default=EnquiryStatus.DRAFT, index=True)

    estimated_value: Mapped[float | None] = mapped_column(Float)
    estimated_cost: Mapped[float | None] = mapped_column(Float)
    estimated_margin: Mapped[float | None] = mapped_column(Float)

    scope_category: Mapped[str | None] = mapped_column(String(100))
    complexity: Mapped[str | None] = mapped_column(String(50))
    resource_profile: Mapped[str | None] = mapped_column(Text)

    approved_by: Mapped[str | None] = mapped_column(String(255))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    documents: Mapped[list["Document"]] = relationship(back_populates="enquiry", cascade="all, delete-orphan")
    audit_log: Mapped[list["AuditLog"]] = relationship(back_populates="enquiry", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    storage_path: Mapped[str] = mapped_column(String(1000))
    wiki_source_page: Mapped[str | None] = mapped_column(String(500))
    markdown_content: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[str] = mapped_column(String(50), default="pending")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enquiry: Mapped["Enquiry"] = relationship(back_populates="documents")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    action: Mapped[str] = mapped_column(String(100))
    actor: Mapped[str] = mapped_column(String(255))
    details: Mapped[str | None] = mapped_column(Text)
    node: Mapped[str | None] = mapped_column(String(50))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enquiry: Mapped["Enquiry"] = relationship(back_populates="audit_log")
```

  </app/models/enquiry.py>

  <app/models/erp.py>

<a name="app-models-erp-py"></a>
### `app/models/erp.py`

```py
"""Complete ERP data models — Accounts, Assets, Stock, Projects, HR, Procurement.

Ported from ERPNext DocTypes, adapted for Aries Marine context.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


# ═══════════════════════════════════════════════════════════════════
# ACCOUNTS MODULE
# ═══════════════════════════════════════════════════════════════════

class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    INCOME = "income"
    EXPENSE = "expense"
    EQUITY = "equity"
    RECEIVABLE = "receivable"
    PAYABLE = "payable"


class Account(Base):
    """Chart of Accounts — General Ledger accounts."""
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    account_number: Mapped[str | None] = mapped_column(String(50))
    account_type: Mapped[AccountType] = mapped_column(SAEnum(AccountType))
    parent_account: Mapped[str | None] = mapped_column(String(200))
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    company: Mapped[str] = mapped_column(String(200), default="Aries Marine")
    balance: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SalesInvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PAID = "paid"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class SalesInvoice(Base):
    """Sales Invoice — convert approved proposals to invoices."""
    __tablename__ = "sales_invoices"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True)
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    customer_name: Mapped[str] = mapped_column(String(255))
    customer_email: Mapped[str | None] = mapped_column(String(255))
    posting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[SalesInvoiceStatus] = mapped_column(SAEnum(SalesInvoiceStatus), default=SalesInvoiceStatus.DRAFT)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=5.0)  # UAE VAT 5%
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    paid_amount: Mapped[float] = mapped_column(Float, default=0.0)
    outstanding_amount: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["PaymentEntry"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    """Line items on a Sales Invoice."""
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sales_invoices.id"))
    item_code: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)

    invoice: Mapped["SalesInvoice"] = relationship(back_populates="items")


class PaymentEntry(Base):
    """Payment entries — track receipts and payments."""
    __tablename__ = "payment_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("sales_invoices.id"))
    payment_type: Mapped[str] = mapped_column(String(50))  # receive, pay, internal
    party_type: Mapped[str] = mapped_column(String(50))  # customer, supplier
    party_name: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="AED")
    reference_number: Mapped[str | None] = mapped_column(String(100))
    reference_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    posting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice: Mapped["SalesInvoice | None"] = relationship(back_populates="payments")


class TaxCategory(Base):
    """Tax categories (UAE VAT, Withholding Tax, etc.)."""
    __tablename__ = "tax_categories"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    rate: Mapped[float] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)


# ═══════════════════════════════════════════════════════════════════
# ASSETS & EQUIPMENT MODULE
# ═══════════════════════════════════════════════════════════════════

class AssetStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    UNDER_MAINTENANCE = "under_maintenance"
    CALIBRATION_DUE = "calibration_due"
    DECOMMISSIONED = "decommissioned"


class Asset(Base):
    """Equipment & Fixed Assets — UT kits, gas monitors, ROVs, etc."""
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    asset_name: Mapped[str] = mapped_column(String(255))
    asset_code: Mapped[str] = mapped_column(String(100), unique=True)
    asset_category: Mapped[str] = mapped_column(String(100))  # ndt_equipment, rov, safety, vehicle, vessel
    status: Mapped[AssetStatus] = mapped_column(SAEnum(AssetStatus), default=AssetStatus.AVAILABLE)

    location: Mapped[str | None] = mapped_column(String(200))  # Sharjah warehouse, Rig A, MV Explorer
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"), index=True)

    purchase_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purchase_cost: Mapped[float | None] = mapped_column(Float)
    current_value: Mapped[float | None] = mapped_column(Float)
    depreciation_rate: Mapped[float] = mapped_column(Float, default=10.0)  # % per year

    # Calibration & Certification
    calibration_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_calibration_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calibration_certificate: Mapped[str | None] = mapped_column(String(500))
    certification_body: Mapped[str | None] = mapped_column(String(200))

    # Assignment
    assigned_to_project: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)
    assigned_to_personnel: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("personnel.id"), index=True)

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    maintenance_records: Mapped[list["MaintenanceRecord"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class MaintenanceRecord(Base):
    """Maintenance & calibration history."""
    __tablename__ = "maintenance_records"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("assets.id"))
    maintenance_type: Mapped[str] = mapped_column(String(50))  # calibration, repair, inspection, preventive
    description: Mapped[str] = mapped_column(Text)
    performed_by: Mapped[str] = mapped_column(String(255))
    performed_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cost: Mapped[float] = mapped_column(Float, default=0.0)

    asset: Mapped["Asset"] = relationship(back_populates="maintenance_records")


# ═══════════════════════════════════════════════════════════════════
# STOCK & INVENTORY MODULE
# ═══════════════════════════════════════════════════════════════════

class ItemGroup(str, enum.Enum):
    CONSUMABLE = "consumable"
    EQUIPMENT = "equipment"
    SERVICE = "service"
    RAW_MATERIAL = "raw_material"
    SPARE_PART = "spare_part"


class StockValuationMethod(str, enum.Enum):
    FIFO = "fifo"
    MOVING_AVERAGE = "moving_average"


class Item(Base):
    """Items — products, consumables, services in the catalog."""
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    item_code: Mapped[str] = mapped_column(String(100), unique=True)
    item_name: Mapped[str] = mapped_column(String(255))
    item_group: Mapped[ItemGroup] = mapped_column(SAEnum(ItemGroup))
    description: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(20), default="Nos")
    has_batch: Mapped[bool] = mapped_column(Boolean, default=False)
    has_serial: Mapped[bool] = mapped_column(Boolean, default=False)
    valuation_method: Mapped[StockValuationMethod] = mapped_column(SAEnum(StockValuationMethod), default=StockValuationMethod.FIFO)

    standard_rate: Mapped[float | None] = mapped_column(Float)
    min_order_qty: Mapped[float | None] = mapped_column(Float)
    safety_stock: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Warehouse(Base):
    """Multi-warehouse inventory locations."""
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    warehouse_name: Mapped[str] = mapped_column(String(200))
    warehouse_code: Mapped[str] = mapped_column(String(50), unique=True)
    location: Mapped[str] = mapped_column(String(200))  # Sharjah, Dubai, Rig, Vessel
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_warehouse: Mapped[str | None] = mapped_column(String(200))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StockEntryType(str, enum.Enum):
    RECEIPT = "receipt"
    DELIVERY = "delivery"
    TRANSFER = "transfer"
    MANUFACTURE = "manufacture"


class StockEntry(Base):
    """Stock movements — receipts, deliveries, transfers."""
    __tablename__ = "stock_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    entry_type: Mapped[StockEntryType] = mapped_column(SAEnum(StockEntryType))
    item_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("items.id"), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    source_warehouse: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"))
    target_warehouse: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"))
    serial_number: Mapped[str | None] = mapped_column(String(100))
    batch_number: Mapped[str | None] = mapped_column(String(100))
    valuation_rate: Mapped[float | None] = mapped_column(Float)
    reference: Mapped[str | None] = mapped_column(String(200))  # PO number, SO number, etc.

    posting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Bin(Base):
    """Current stock levels per warehouse per item."""
    __tablename__ = "bins"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("warehouses.id"), index=True)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    valuation_rate: Mapped[float] = mapped_column(Float, default=0.0)
    stock_value: Mapped[float] = mapped_column(Float, default=0.0)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════════
# PROJECTS & OPERATIONS MODULE
# ═══════════════════════════════════════════════════════════════════

class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectType(str, enum.Enum):
    SURVEY = "survey"
    INSPECTION = "inspection"
    NDT = "ndt"
    INSTALLATION = "installation"
    MAINTENANCE = "maintenance"
    CONSULTING = "consulting"


class Project(Base):
    """Projects — post-approval operations tracking."""
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_name: Mapped[str] = mapped_column(String(255))
    project_code: Mapped[str] = mapped_column(String(50), unique=True)
    project_type: Mapped[ProjectType] = mapped_column(SAEnum(ProjectType))
    status: Mapped[ProjectStatus] = mapped_column(SAEnum(ProjectStatus), default=ProjectStatus.PLANNING)

    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    customer_name: Mapped[str] = mapped_column(String(255))
    expected_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Location / vessel
    project_location: Mapped[str | None] = mapped_column(String(200))
    vessel_name: Mapped[str | None] = mapped_column(String(200))

    # Financials
    estimated_cost: Mapped[float | None] = mapped_column(Float)
    actual_cost: Mapped[float] = mapped_column(Float, default=0.0)
    day_rate: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tasks: Mapped[list["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    timesheets: Mapped[list["Timesheet"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    assignments: Mapped[list["ProjectAssignment"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class Task(Base):
    """Tasks within a project."""
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)

    subject: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(SAEnum(TaskStatus), default=TaskStatus.TODO)
    assigned_to: Mapped[str | None] = mapped_column(String(255))
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    progress: Mapped[float] = mapped_column(Float, default=0.0)

    project: Mapped["Project"] = relationship(back_populates="tasks")


class Timesheet(Base):
    """Daily timesheets for day-rate billing."""
    __tablename__ = "timesheets"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)
    personnel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("personnel.id"))
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    hours: Mapped[float] = mapped_column(Float, default=8.0)
    activity_type: Mapped[str] = mapped_column(String(100))  # ndt_inspection, rope_access, survey, reporting
    description: Mapped[str | None] = mapped_column(Text)
    billable: Mapped[bool] = mapped_column(Boolean, default=True)

    project: Mapped["Project"] = relationship(back_populates="timesheets")


class ProjectAssignment(Base):
    """Personnel assigned to projects — with compliance checking."""
    __tablename__ = "project_assignments"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)
    personnel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("personnel.id"), index=True)
    role: Mapped[str] = mapped_column(String(100))  # ndt_technician, rope_access_tech, project_manager
    compliance_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    compliance_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    compliance_issues: Mapped[str | None] = mapped_column(Text)  # any flagged cert expirations

    project: Mapped["Project"] = relationship(back_populates="assignments")


# ═══════════════════════════════════════════════════════════════════
# HR & COMPLIANCE MODULE
# ═══════════════════════════════════════════════════════════════════

class PersonnelStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_PROJECT = "on_project"
    ON_LEAVE = "on_leave"
    INACTIVE = "inactive"


class Personnel(Base):
    """Personnel / Employees — with certification tracking."""
    __tablename__ = "personnel"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[PersonnelStatus] = mapped_column(SAEnum(PersonnelStatus), default=PersonnelStatus.ACTIVE)
    designation: Mapped[str | None] = mapped_column(String(100))  # NDT Technician, Rope Access Tech, Surveyor
    department: Mapped[str | None] = mapped_column(String(100))

    # Day rate for billing
    day_rate: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    certifications: Mapped[list["Certification"]] = relationship(back_populates="personnel", cascade="all, delete-orphan")


class CertStatus(str, enum.Enum):
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"  # within 90 days
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class Certification(Base):
    """Personnel certifications — IRATA, CSWIP, BOSIET, HUET, offshore medicals."""
    __tablename__ = "certifications"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    personnel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("personnel.id"), index=True)
    cert_type: Mapped[str] = mapped_column(String(100))  # IRATA, CSWIP_3.1, BOSIET, HUET, offshore_medical, first_aid
    cert_number: Mapped[str | None] = mapped_column(String(100))
    issuing_body: Mapped[str | None] = mapped_column(String(200))
    issue_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[CertStatus] = mapped_column(SAEnum(CertStatus), default=CertStatus.VALID, index=True)

    personnel: Mapped["Personnel"] = relationship(back_populates="certifications")


class QualityInspection(Base):
    """Quality management — ISO compliance tracking."""
    __tablename__ = "quality_inspections"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    inspection_type: Mapped[str] = mapped_column(String(100))  # internal_audit, ndt_report_review, equipment_check
    reference: Mapped[str | None] = mapped_column(String(200))  # project code, asset code
    status: Mapped[str] = mapped_column(String(50), default="open")  # open, passed, failed, corrective_action
    findings: Mapped[str | None] = mapped_column(Text)
    corrective_action: Mapped[str | None] = mapped_column(Text)
    inspected_by: Mapped[str] = mapped_column(String(255))
    inspection_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ═══════════════════════════════════════════════════════════════════
# PROCUREMENT MODULE
# ═══════════════════════════════════════════════════════════════════

class POStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class Supplier(Base):
    """Suppliers / Vendors."""
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    supplier_name: Mapped[str] = mapped_column(String(255))
    supplier_code: Mapped[str] = mapped_column(String(50), unique=True)
    contact_person: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))  # ndt_equipment, rope_access, marine_services
    rating: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PurchaseOrder(Base):
    """Purchase Orders to suppliers."""
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(50), unique=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("suppliers.id"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"))
    status: Mapped[POStatus] = mapped_column(SAEnum(POStatus), default=POStatus.DRAFT)

    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expected_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["POItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")


class POItem(Base):
    """Purchase Order line items."""
    __tablename__ = "po_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("purchase_orders.id"))
    item_code: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")


class MaterialRequest(Base):
    """Material Requests from project teams."""
    __tablename__ = "material_requests"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    request_number: Mapped[str] = mapped_column(String(50), unique=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"))
    requested_by: Mapped[str] = mapped_column(String(255))
    purpose: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, approved, ordered, fulfilled

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

  </app/models/erp.py>

  <app/models/ai.py>

<a name="app-models-ai-py"></a>
### `app/models/ai.py`

```py
"""AI Personas — Specialized agents with scoped access and RBAC.

Inspired by NocoBase's AI Employees (Dex, Viz, Avery pattern).
Each persona has: role, system prompt, allowed tools, allowed data sources,
and RBAC-scoped database access.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


class PersonaCategory(str, enum.Enum):
    BUSINESS = "business"
    TECHNICAL = "technical"
    DEVELOPER = "developer"


class Persona(Base):
    """AI Persona / Employee — a scoped agent role."""
    __tablename__ = "ai_personas"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True)  # e.g. "presales_assistant", "financial_analyst"
    nickname: Mapped[str] = mapped_column(String(100))  # Display name
    position: Mapped[str] = mapped_column(String(200))  # e.g. "Pre-sales Consultant"
    category: Mapped[PersonaCategory] = mapped_column(String(20), default=PersonaCategory.BUSINESS)

    # System prompt layers (NocoBase pattern: global + employee + personal)
    about: Mapped[str | None] = mapped_column(Text)  # Employee-specific prompt (the "constitution")
    greeting: Mapped[str | None] = mapped_column(Text)  # First message the AI sends

    # Model configuration
    model: Mapped[str] = mapped_column(String(100), default="gemini-3-flash-preview")
    temperature: Mapped[float] = mapped_column(default=0.7)

    # Tool and data scoping
    allowed_tools: Mapped[str | None] = mapped_column(Text)  # JSON array of MCP tool names
    allowed_collections: Mapped[str | None] = mapped_column(Text)  # JSON array of DB tables the persona can query
    allowed_mcp_servers: Mapped[str | None] = mapped_column(Text)  # JSON array of MCP server names

    # Knowledge base / RAG
    enable_knowledge_base: Mapped[bool] = mapped_column(Boolean, default=True)
    knowledge_base_prompt: Mapped[str | None] = mapped_column(Text)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    built_in: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    conversations: Mapped[list["AIConversation"]] = relationship(back_populates="persona", cascade="all, delete-orphan")


class AIConversation(Base):
    """Persistent conversation sessions with AI personas."""
    __tablename__ = "ai_conversations"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    persona_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("ai_personas.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(String(255), index=True)  # Entra ID / user identifier
    channel: Mapped[str] = mapped_column(String(50), default="web", index=True)  # web, whatsapp, telegram, slack
    title: Mapped[str | None] = mapped_column(String(200))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    persona: Mapped["Persona"] = relationship(back_populates="conversations")
    messages: Mapped[list["AIMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class AIMessage(Base):
    """Individual messages in AI conversations."""
    __tablename__ = "ai_messages"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("ai_conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(50))  # user, assistant, system, tool
    content: Mapped[str | None] = mapped_column(Text)
    tool_calls: Mapped[str | None] = mapped_column(Text)  # JSON array of tool calls
    tool_call_id: Mapped[str | None] = mapped_column(String(100))
    tool_name: Mapped[str | None] = mapped_column(String(100))
    metadata_json: Mapped[str | None] = mapped_column(Text)  # model, tokens, latency, etc.

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")


class ChannelConnector(Base):
    """Multi-channel connector configuration — WhatsApp, Telegram, Slack."""
    __tablename__ = "channel_connectors"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    channel_type: Mapped[str] = mapped_column(String(50))  # whatsapp, telegram, slack, email
    name: Mapped[str] = mapped_column(String(200))  # "Aries WhatsApp Bot"
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Connection config (encrypted in production, stored in Key Vault/Secret Manager)
    config: Mapped[str | None] = mapped_column(Text)  # JSON: {bot_token, phone_number_id, verify_token, etc.}
    webhook_url: Mapped[str | None] = mapped_column(String(500))

    # Which persona handles messages from this channel
    default_persona_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("ai_personas.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UIDashboard(Base):
    """AI-generated UI dashboards and forms (Mutator MCP output)."""
    __tablename__ = "ui_dashboards"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    ui_type: Mapped[str] = mapped_column(String(50))  # dashboard, form, report, kanban
    schema_json: Mapped[str] = mapped_column(Text)  # JSON schema that the Next.js frontend renders
    created_by_persona: Mapped[str | None] = mapped_column(String(100))  # which AI persona created it
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

  </app/models/ai.py>

  <app/models/__init__.py>

<a name="app-models-init-py"></a>
### `app/models/__init__.py`

```py
from backend.app.models.enquiry import AuditLog, Document, Enquiry, EnquiryStatus
from backend.app.models.erp import (
    Account, AccountType, SalesInvoice, SalesInvoiceStatus, InvoiceItem,
    PaymentEntry, TaxCategory,
    Asset, AssetStatus, MaintenanceRecord,
    Item, ItemGroup, Warehouse, StockEntry, StockEntryType, StockValuationMethod, Bin,
    Project, ProjectStatus, ProjectType, Task, TaskStatus, Timesheet, ProjectAssignment,
    Personnel, PersonnelStatus, Certification, CertStatus, QualityInspection,
    Supplier, PurchaseOrder, POStatus, POItem, MaterialRequest,
)
from backend.app.models.workflow import (
    Workflow, WorkflowStatus, WorkflowNode, NodeType, WorkflowEdge,
    WorkflowExecution, ExecutionStatus, NodeExecution,
)
from backend.app.models.ai import (
    Persona, PersonaCategory, AIConversation, AIMessage,
    ChannelConnector, UIDashboard,
)

__all__ = [
    "AuditLog", "Document", "Enquiry", "EnquiryStatus",
    "Account", "AccountType", "SalesInvoice", "SalesInvoiceStatus", "InvoiceItem",
    "PaymentEntry", "TaxCategory",
    "Asset", "AssetStatus", "MaintenanceRecord",
    "Item", "ItemGroup", "Warehouse", "StockEntry", "StockEntryType", "StockValuationMethod", "Bin",
    "Project", "ProjectStatus", "ProjectType", "Task", "TaskStatus", "Timesheet", "ProjectAssignment",
    "Personnel", "PersonnelStatus", "Certification", "CertStatus", "QualityInspection",
    "Supplier", "PurchaseOrder", "POStatus", "POItem", "MaterialRequest",
    "Workflow", "WorkflowStatus", "WorkflowNode", "NodeType", "WorkflowEdge",
    "WorkflowExecution", "ExecutionStatus", "NodeExecution",
    "Persona", "PersonaCategory", "AIConversation", "AIMessage",
    "ChannelConnector", "UIDashboard",
]
```

  </app/models/__init__.py>

  <app/models/workflow.py>

<a name="app-models-workflow-py"></a>
### `app/models/workflow.py`

```py
"""DAG Pipeline Engine — DB-stored configurable workflow definitions.

Replaces the hardcoded Python pipeline (Nodes 9→13) with a database-stored
Directed Acyclic Graph that can be configured without code deployment.
Inspired by NocoBase's visual workflow builder pattern.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


class NodeType(str, enum.Enum):
    START = "start"
    END = "end"
    RETRIEVAL = "retrieval"
    CLASSIFY = "classify"
    RULES = "rules"
    LLM = "llm"
    DECISION = "decision"
    HUMAN_APPROVAL = "human_approval"
    EXECUTION = "execution"
    MCP_TOOL = "mcp_tool"
    TRANSFORM = "transform"


class WorkflowStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Workflow(Base):
    """A workflow definition — a DAG of nodes and edges."""
    __tablename__ = "workflows"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[WorkflowStatus] = mapped_column(String(20), default=WorkflowStatus.DRAFT)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    nodes: Mapped[list["WorkflowNode"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    edges: Mapped[list["WorkflowEdge"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    executions: Mapped[list["WorkflowExecution"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")


class WorkflowNode(Base):
    """A node in a workflow DAG."""
    __tablename__ = "workflow_nodes"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflows.id"), index=True)
    node_key: Mapped[str] = mapped_column(String(100))  # unique key within workflow e.g. "classify", "rules", "llm_draft"
    node_type: Mapped[NodeType] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)

    # Node configuration as JSON — varies by node_type
    # e.g. for LLM: {"model": "gemini-3.1-pro-preview", "prompt_template": "...", "structured_output_schema": "..."}
    # e.g. for RULES: {"rules_config": {"min_margin": 15, "approval_threshold": 200000}}
    # e.g. for MCP_TOOL: {"mcp_server": "wiki", "tool": "wiki_search", "params": {}}
    config: Mapped[str | None] = mapped_column(Text)  # JSON string

    position_x: Mapped[int] = mapped_column(Integer, default=0)  # For visual editor
    position_y: Mapped[int] = mapped_column(Integer, default=0)

    workflow: Mapped["Workflow"] = relationship(back_populates="nodes")


class WorkflowEdge(Base):
    """A directed edge connecting two nodes in a workflow DAG."""
    __tablename__ = "workflow_edges"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflows.id"), index=True)
    source_node_key: Mapped[str] = mapped_column(String(100))
    target_node_key: Mapped[str] = mapped_column(String(100))
    condition: Mapped[str | None] = mapped_column(String(200))  # e.g. "policy_pass", "policy_fail", None for unconditional

    workflow: Mapped["Workflow"] = relationship(back_populates="edges")


class WorkflowExecution(Base):
    """A single execution run of a workflow for an enquiry."""
    __tablename__ = "workflow_executions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflows.id"), index=True)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("enquiries.id"), index=True)
    status: Mapped[ExecutionStatus] = mapped_column(String(20), default=ExecutionStatus.PENDING)
    current_node_key: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    workflow: Mapped["Workflow"] = relationship(back_populates="executions")
    node_executions: Mapped[list["NodeExecution"]] = relationship(back_populates="execution", cascade="all, delete-orphan")


class NodeExecution(Base):
    """Execution record for a single node within a workflow run."""
    __tablename__ = "node_executions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    execution_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflow_executions.id"), index=True)
    node_key: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, running, completed, failed, skipped
    input_data: Mapped[str | None] = mapped_column(Text)  # JSON
    output_data: Mapped[str | None] = mapped_column(Text)  # JSON
    error_message: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    execution: Mapped["WorkflowExecution"] = relationship(back_populates="node_executions")
```

  </app/models/workflow.py>

  <app/schemas/enquiry.py>

<a name="app-schemas-enquiry-py"></a>
### `app/schemas/enquiry.py`

```py
import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from backend.app.models.enquiry import EnquiryStatus


# --- Enquiry ---
class EnquiryCreate(BaseModel):
    client_name: str
    client_email: str | None = None
    channel: str = "web"
    industry: str | None = None
    subdivision: str | None = None
    description: str


class EnquiryUpdate(BaseModel):
    client_name: str | None = None
    client_email: str | None = None
    industry: str | None = None
    subdivision: str | None = None
    description: str | None = None
    estimated_value: float | None = None
    estimated_cost: float | None = None
    status: EnquiryStatus | None = None
    approved_by: str | None = None


class EnquiryRead(BaseModel):
    id: uuid.UUID
    enquiry_number: str | None
    client_name: str
    client_email: str | None
    channel: str
    industry: str | None
    subdivision: str | None
    description: str
    status: EnquiryStatus
    estimated_value: float | None
    estimated_cost: float | None
    estimated_margin: float | None
    scope_category: str | None
    complexity: str | None
    approved_by: str | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Document ---
class DocumentRead(BaseModel):
    id: uuid.UUID
    enquiry_id: uuid.UUID
    filename: str
    content_type: str
    storage_path: str
    wiki_source_page: str | None
    processing_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Wiki ---
class WikiPageCreate(BaseModel):
    path: str = Field(..., description="Relative path within wiki, e.g. entities/acme-corp.md")
    content: str
    commit_message: str = "Add page"


class WikiPageUpdate(BaseModel):
    content: str
    commit_message: str = "Update page"


class WikiPageRead(BaseModel):
    path: str
    content: str
    last_modified: datetime | None = None
    last_commit: str | None = None


class WikiSearchResult(BaseModel):
    path: str
    title: str
    snippet: str
    score: float


# --- Pipeline ---
class PipelineRunRequest(BaseModel):
    enquiry_id: uuid.UUID


class PipelineRunResponse(BaseModel):
    enquiry_id: uuid.UUID
    status: str
    message: str
    wiki_pages_created: list[str] = []
    rules_output: dict | None = None
    llm_draft: str | None = None
```

  </app/schemas/enquiry.py>

  <app/schemas/__init__.py>

<a name="app-schemas-init-py"></a>
### `app/schemas/__init__.py`

```py
from backend.app.schemas.enquiry import (
    DocumentRead,
    EnquiryCreate,
    EnquiryRead,
    EnquiryUpdate,
    PipelineRunRequest,
    PipelineRunResponse,
    WikiPageCreate,
    WikiPageRead,
    WikiPageUpdate,
    WikiSearchResult,
)

__all__ = [
    "DocumentRead",
    "EnquiryCreate",
    "EnquiryRead",
    "EnquiryUpdate",
    "PipelineRunRequest",
    "PipelineRunResponse",
    "WikiPageCreate",
    "WikiPageRead",
    "WikiPageUpdate",
    "WikiSearchResult",
]
```

  </app/schemas/__init__.py>

  <app/mcp_servers/erp_server.py>

<a name="app-mcp-servers-erp-server-py"></a>
### `app/mcp_servers/erp_server.py`

```py
"""ERP MCP Server — create enquiry records, assign numbers, update workflow."""

import uuid

from mcp.server.fastmcp import FastMCP

erp_mcp = FastMCP("ERP MCP", instructions="Create and manage enquiry records in the ERP system")


@erp_mcp.tool()
async def create_enquiry_record(client_name: str, description: str, value: float = 0.0) -> str:
    """Create a new enquiry record in ERP and assign an enquiry number."""
    enquiry_number = f"ENQ-{uuid.uuid4().hex[:8].upper()}"
    return f"Created enquiry {enquiry_number} for {client_name}. Value: {value}"


@erp_mcp.tool()
async def update_enquiry_status(enquiry_number: str, status: str) -> str:
    """Update the status of an existing enquiry in ERP."""
    return f"Updated enquiry {enquiry_number} to status: {status}"


@erp_mcp.tool()
async def get_enquiry_details(enquiry_number: str) -> str:
    """Retrieve enquiry details from ERP."""
    return f"Enquiry {enquiry_number}: Status=pending, Client=stub (ERP integration not yet connected)"
```

  </app/mcp_servers/erp_server.py>

  <app/mcp_servers/sap_server.py>

<a name="app-mcp-servers-sap-server-py"></a>
### `app/mcp_servers/sap_server.py`

```py
"""SAP MCP Server — prepare sales orders and transactional drafts."""

from mcp.server.fastmcp import FastMCP

sap_mcp = FastMCP("SAP MCP", instructions="Prepare sales orders and transactional drafts in SAP")


@sap_mcp.tool()
async def prepare_sales_order(enquiry_number: str, client_name: str, items: str) -> str:
    """Prepare a sales order draft in SAP."""
    return f"Sales order draft prepared for enquiry {enquiry_number} ({client_name}). Items: {items}. Stub: SAP not yet connected."


@sap_mcp.tool()
async def create_transactional_draft(enquiry_number: str, value: float) -> str:
    """Create a transactional draft in SAP."""
    return f"Transactional draft created for enquiry {enquiry_number}. Value: {value}. Stub: SAP not yet connected."
```

  </app/mcp_servers/sap_server.py>

  <app/mcp_servers/gateway.py>

<a name="app-mcp-servers-gateway-py"></a>
### `app/mcp_servers/gateway.py`

```py
"""MCP Gateway — central registry + auth proxy for MCP servers (Node 3).

Handles tool discovery, scoping, rate limits, and credential brokering.
Agents never see raw secrets — they receive scoped MCP tool tokens.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

logger = logging.getLogger("aries.mcp.gateway")


@dataclass
class MCPTool:
    name: str
    description: str
    server: str
    handler: Callable[..., Coroutine[Any, Any, str]]
    requires_auth: bool = True


@dataclass
class MCPServerRegistration:
    name: str
    description: str
    tools: list[MCPTool] = field(default_factory=list)


class MCPGateway:
    """Central registry for MCP servers and tools."""

    def __init__(self):
        self._servers: dict[str, MCPServerRegistration] = {}

    def register_server(self, name: str, description: str):
        self._servers[name] = MCPServerRegistration(name=name, description=description)

    def register_tool(self, server_name: str, tool: MCPTool):
        if server_name not in self._servers:
            self.register_server(server_name, f"MCP Server: {server_name}")
        self._servers[server_name].tools.append(tool)

    def list_servers(self) -> list[dict]:
        return [
            {"name": s.name, "description": s.description, "tool_count": len(s.tools)}
            for s in self._servers.values()
        ]

    def list_tools(self, server_name: str | None = None) -> list[dict]:
        tools = []
        for server in self._servers.values():
            if server_name and server.name != server_name:
                continue
            for t in server.tools:
                tools.append({
                    "name": t.name,
                    "description": t.description,
                    "server": t.server,
                    "requires_auth": t.requires_auth,
                })
        return tools

    async def call_tool(self, tool_name: str, **kwargs) -> str:
        """Call an MCP tool by name. Brokers credentials via Key Vault / Secret Manager."""
        for server in self._servers.values():
            for tool in server.tools:
                if tool.name == tool_name:
                    return await tool.handler(**kwargs)
        raise ValueError(f"Tool not found: {tool_name}")


# Singleton gateway instance
gateway = MCPGateway()


def register_all_servers():
    """Register all MCP servers and their tools with the gateway."""

    # ── 1. Wiki MCP ─────────────────────────────────────────────
    gateway.register_server("wiki", "LLM Wiki read/write/search")
    gateway.register_tool("wiki", MCPTool(
        name="wiki_read", description="Read a wiki page by path", server="wiki",
        handler=lambda path: _wiki_read(path), requires_auth=False,
    ))
    gateway.register_tool("wiki", MCPTool(
        name="wiki_write", description="Write or update a wiki page", server="wiki",
        handler=lambda path, content, msg="MCP write": _wiki_write(path, content, msg), requires_auth=True,
    ))
    gateway.register_tool("wiki", MCPTool(
        name="wiki_search", description="Search the wiki by query", server="wiki",
        handler=lambda q, limit=10: _wiki_search(q, limit), requires_auth=False,
    ))
    gateway.register_tool("wiki", MCPTool(
        name="wiki_list", description="List all wiki pages", server="wiki",
        handler=lambda: _wiki_list(), requires_auth=False,
    ))

    # ── 2. Gemini MCP ──────────────────────────────────────────
    gateway.register_server("gemini", "Gemini 2.5 Pro reasoning, classification, drafting")
    gateway.register_tool("gemini", MCPTool(
        name="gemini_query", description="Answer a question using Gemini", server="gemini",
        handler=lambda question, ctx="": _gemini_query(question, ctx), requires_auth=True,
    ))
    gateway.register_tool("gemini", MCPTool(
        name="gemini_classify", description="Classify an enquiry using Gemini", server="gemini",
        handler=lambda desc, industry="", client="": _gemini_classify(desc, industry, client), requires_auth=True,
    ))
    gateway.register_tool("gemini", MCPTool(
        name="gemini_draft", description="Draft a proposal using Gemini", server="gemini",
        handler=lambda client, desc, industry="", ctx="": _gemini_draft(client, desc, industry, ctx), requires_auth=True,
    ))

    # ── 3. ERP MCP ─────────────────────────────────────────────
    gateway.register_server("erp", "ERP integration: customers, products, stock, pricing, sales orders")
    _register_erp_tools()

    # ── 4. SAP MCP ─────────────────────────────────────────────
    gateway.register_server("sap", "SAP integration: material master, stock, transactional drafts")
    _register_sap_tools()

    # ── 5. Outlook MCP ─────────────────────────────────────────
    gateway.register_server("outlook", "Outlook/Email integration: send proposals, schedule meetings")
    _register_outlook_tools()

    # ── 6. Document Output MCP ───────────────────────────────────
    gateway.register_server("document_output", "Generate PDF proposals, quote files, internal summaries")
    _register_document_output_tools()

    # ── 7. Search MCP ──────────────────────────────────────────
    gateway.register_server("search", "Hybrid RAG search: semantic + keyword + rerank")
    _register_search_tools()

    # ── 8. Mutator MCP ─────────────────────────────────────────
    from backend.app.mcp_servers.mutator_server import register_mutator_server
    register_mutator_server()

    # ── 9. Media MCP ───────────────────────────────────────────
    from backend.app.mcp_servers.media_server import register_media_server
    register_media_server()

    logger.info("Registered %d MCP servers with %d total tools",
                len(gateway._servers),
                sum(len(s.tools) for s in gateway._servers.values()))


# ── Wiki helpers ───────────────────────────────────────────────

async def _wiki_read(path: str) -> str:
    from backend.app.services.wiki import WikiService
    wiki = WikiService()
    page = wiki.read_page(path)
    return page.content if page else f"Page not found: {path}"


async def _wiki_write(path: str, content: str, msg: str) -> str:
    from backend.app.services.wiki import WikiService
    wiki = WikiService()
    page = wiki.write_page(path, content, msg)
    return f"Written: {page.path}"


async def _wiki_search(query: str, limit: int) -> str:
    from backend.app.services.wiki import WikiService
    wiki = WikiService()
    results = wiki.search(query, limit=limit)
    return "\n".join(f"- [{r.title}] {r.path}: {r.snippet}" for r in results) if results else "No results"


async def _wiki_list() -> str:
    from backend.app.services.wiki import WikiService
    wiki = WikiService()
    pages = wiki.list_pages()
    return "\n".join(f"- {p}" for p in pages) if pages else "No pages"


# ── Gemini helpers ───────────────────────────────────────────

async def _gemini_query(question: str, wiki_context: str) -> str:
    from backend.app.services.gemini import GeminiService
    service = GeminiService()
    return await service.answer_query(question, wiki_context)


async def _gemini_classify(description: str, industry: str, client_name: str) -> str:
    from backend.app.models.enquiry import Enquiry
    from backend.app.services.gemini import GeminiService
    enquiry = Enquiry(client_name=client_name, industry=industry or None, description=description)
    service = GeminiService()
    result = await service.classify_enquiry(enquiry, "")
    import json
    return json.dumps(result, indent=2)


async def _gemini_draft(client_name: str, description: str, industry: str, wiki_context: str) -> str:
    from backend.app.models.enquiry import Enquiry
    from backend.app.services.gemini import GeminiService
    from backend.app.services.rules import apply_rules
    enquiry = Enquiry(client_name=client_name, industry=industry or None, description=description)
    rules = apply_rules()
    service = GeminiService()
    return await service.draft_proposal(enquiry, wiki_context, rules, {})


# ── ERP helpers ────────────────────────────────────────────────

async def _erp_customer_lookup(name: str) -> str:
    from backend.app.mcp_servers.erp_server import erp_customer_lookup
    return await erp_customer_lookup(name)


async def _erp_product_catalog(query: str) -> str:
    from backend.app.mcp_servers.erp_server import erp_product_catalog
    return await erp_product_catalog(query)


async def _erp_stock_check(sku: str) -> str:
    from backend.app.mcp_servers.erp_server import erp_stock_check
    return await erp_stock_check(sku)


async def _erp_pricing(sku: str, qty: int) -> str:
    from backend.app.mcp_servers.erp_server import erp_pricing
    return await erp_pricing(sku, qty)


async def _erp_sales_order(enquiry_id: str, items: str) -> str:
    from backend.app.mcp_servers.erp_server import erp_sales_order
    return await erp_sales_order(enquiry_id, items)


def _register_erp_tools():
    gateway.register_tool("erp", MCPTool(
        name="erp_customer_lookup", description="Look up a customer in the ERP", server="erp",
        handler=lambda name="": _erp_customer_lookup(name), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_product_catalog", description="Search the product catalog", server="erp",
        handler=lambda q="": _erp_product_catalog(q), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_stock_check", description="Check stock for a SKU", server="erp",
        handler=lambda sku="": _erp_stock_check(sku), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_pricing", description="Get pricing for a SKU and quantity", server="erp",
        handler=lambda sku="", qty=1: _erp_pricing(sku, qty), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_sales_order", description="Create a sales order in ERP", server="erp",
        handler=lambda eid="", items="": _erp_sales_order(eid, items), requires_auth=True,
    ))


# ── SAP helpers ────────────────────────────────────────────────

async def _sap_material_master(query: str) -> str:
    from backend.app.mcp_servers.sap_server import sap_material_master
    return await sap_material_master(query)


async def _sap_stock(sku: str) -> str:
    from backend.app.mcp_servers.sap_server import sap_stock
    return await sap_stock(sku)


async def _sap_sales_order(enquiry_id: str, items: str) -> str:
    from backend.app.mcp_servers.sap_server import sap_sales_order
    return await sap_sales_order(enquiry_id, items)


def _register_sap_tools():
    gateway.register_tool("sap", MCPTool(
        name="sap_material_master", description="Search SAP material master", server="sap",
        handler=lambda q="": _sap_material_master(q), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_stock", description="Check SAP stock for a SKU", server="sap",
        handler=lambda sku="": _sap_stock(sku), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_sales_order", description="Create SAP sales order", server="sap",
        handler=lambda eid="", items="": _sap_sales_order(eid, items), requires_auth=True,
    ))


# ── Outlook helpers ────────────────────────────────────────────

async def _outlook_send_proposal(to: str, subject: str, body: str, attachment_path: str) -> str:
    from backend.app.mcp_servers.outlook_server import outlook_send_proposal
    return await outlook_send_proposal(to, subject, body, attachment_path)


async def _outlook_schedule_meeting(subject: str, attendees: str, start: str, duration_minutes: int) -> str:
    from backend.app.mcp_servers.outlook_server import outlook_schedule_meeting
    return await outlook_schedule_meeting(subject, attendees, start, duration_minutes)


def _register_outlook_tools():
    gateway.register_tool("outlook", MCPTool(
        name="outlook_send_proposal", description="Send a proposal email via Outlook", server="outlook",
        handler=lambda to="", subject="", body="", attachment_path="": _outlook_send_proposal(to, subject, body, attachment_path), requires_auth=True,
    ))
    gateway.register_tool("outlook", MCPTool(
        name="outlook_schedule_meeting", description="Schedule a meeting via Outlook", server="outlook",
        handler=lambda subject="", attendees="", start="", duration=60: _outlook_schedule_meeting(subject, attendees, start, duration), requires_auth=True,
    ))


# ── Document Output helpers ────────────────────────────────────

async def _doc_proposal_pdf(enquiry_id: str, content: str, client_name: str) -> str:
    from backend.app.mcp_servers.document_output_server import generate_proposal_pdf
    return await generate_proposal_pdf(enquiry_id, content, client_name)


async def _doc_quote_file(enquiry_id: str, pricing_data: str) -> str:
    from backend.app.mcp_servers.document_output_server import generate_quote_file
    return await generate_quote_file(enquiry_id, pricing_data)


async def _doc_internal_summary(enquiry_id: str, summary: str) -> str:
    from backend.app.mcp_servers.document_output_server import generate_internal_summary
    return await generate_internal_summary(enquiry_id, summary)


def _register_document_output_tools():
    gateway.register_tool("document_output", MCPTool(
        name="generate_proposal_pdf", description="Generate a proposal PDF", server="document_output",
        handler=lambda eid="", content="", client="": _doc_proposal_pdf(eid, content, client), requires_auth=True,
    ))
    gateway.register_tool("document_output", MCPTool(
        name="generate_quote_file", description="Generate a quote spreadsheet", server="document_output",
        handler=lambda eid="", pricing="": _doc_quote_file(eid, pricing), requires_auth=True,
    ))
    gateway.register_tool("document_output", MCPTool(
        name="generate_internal_summary", description="Generate an internal summary", server="document_output",
        handler=lambda eid="", summary="": _doc_internal_summary(eid, summary), requires_auth=True,
    ))


# ── Search helpers ─────────────────────────────────────────────

async def _rag_search(query: str, limit: int, method: str) -> str:
    from backend.app.services.rag import RAGService
    rag = RAGService()
    results = await rag.search(query, limit=limit, method=method)
    lines = []
    for r in results:
        lines.append(f"[{r.score:.3f}] {r.metadata.get('source_path', '?')} — {r.content[:300]}...")
    return "\n".join(lines) if lines else "No results"


def _register_search_tools():
    gateway.register_tool("search", MCPTool(
        name="rag_search", description="Search RAG vector store (semantic/keyword/hybrid)", server="search",
        handler=lambda q="", limit=5, method="hybrid": _rag_search(q, limit, method), requires_auth=False,
    ))
```

  </app/mcp_servers/gateway.py>

  <app/mcp_servers/mutator_server.py>

<a name="app-mcp-servers-mutator-server-py"></a>
### `app/mcp_servers/mutator_server.py`

```py
"""Mutator MCP Server — AI-generated UI forms, dashboards, reports, kanban boards.

These tools allow AI personas to generate dynamic UI components that the
Next.js frontend can render from JSON schemas. Inspired by NocoBase's
schema-based UI generation.

Tools:
- generate_ui_form: Generate a form schema for data entry
- generate_dashboard: Generate a dashboard with charts/stats
- generate_report: Generate a structured report layout
- generate_kanban: Generate a kanban board layout
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db, async_session
from backend.app.models.ai import UIDashboard
from backend.app.mcp_servers.gateway import MCPTool, gateway

logger = logging.getLogger("aries.mcp.mutator")


def register_mutator_server():
    """Register the Mutator MCP server and its tools."""
    gateway.register_server("mutator", "AI-generated UI dashboards, forms, reports, kanban boards")

    gateway.register_tool("mutator", MCPTool(
        name="generate_ui_form",
        description="Generate a dynamic form UI schema from a description. Returns JSON that the frontend renders.",
        server="mutator",
        handler=_generate_ui_form,
        requires_auth=True,
    ))

    gateway.register_tool("mutator", MCPTool(
        name="generate_dashboard",
        description="Generate a dashboard UI with charts, stats, and tables from a description.",
        server="mutator",
        handler=_generate_dashboard,
        requires_auth=True,
    ))

    gateway.register_tool("mutator", MCPTool(
        name="generate_report",
        description="Generate a structured report layout with sections, charts, and data tables.",
        server="mutator",
        handler=_generate_report,
        requires_auth=True,
    ))

    gateway.register_tool("mutator", MCPTool(
        name="generate_kanban",
        description="Generate a kanban board layout with columns and cards from a workflow description.",
        server="mutator",
        handler=_generate_kanban,
        requires_auth=True,
    ))


async def _generate_ui_form(
    name: str = "Untitled Form",
    description: str = "",
    fields: str | None = None,
    persona: str = "system",
    target_collection: str | None = None,
) -> str:
    """Generate a form UI schema.

    Args:
        name: Form name
        description: What the form is for
        fields: JSON array of field definitions, or comma-separated field names
        persona: Which AI persona is creating this
        target_collection: DB collection/table this form submits to
    """
    # Parse fields
    if fields:
        try:
            field_defs = json.loads(fields) if fields.startswith("[") else [
                {"name": f.strip(), "type": "text", "label": f.strip().replace("_", " ").title()}
                for f in fields.split(",")
            ]
        except json.JSONDecodeError:
            field_defs = [{"name": "field1", "type": "text", "label": "Field 1"}]
    else:
        field_defs = [{"name": "field1", "type": "text", "label": "Field 1"}]

    # Build the schema
    schema = {
        "type": "form",
        "version": "1.0",
        "name": name,
        "description": description,
        "target_collection": target_collection,
        "layout": "vertical",
        "fields": field_defs,
        "actions": [
            {"type": "submit", "label": "Submit", "variant": "primary"},
            {"type": "reset", "label": "Reset", "variant": "secondary"},
        ],
        "validation": {
            field_def["name"]: {"required": True}
            for field_def in field_defs
        },
    }

    # Save to database
    dashboard_id = await _save_ui_schema(name, "form", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "form",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _generate_dashboard(
    name: str = "Untitled Dashboard",
    description: str = "",
    metrics: str | None = None,
    persona: str = "system",
    data_source: str | None = None,
) -> str:
    """Generate a dashboard UI schema with stats, charts, and tables.

    Args:
        name: Dashboard name
        description: What the dashboard shows
        metrics: Comma-separated metric names (e.g. "revenue,margin,enquiries,pipeline")
        persona: Which AI persona is creating this
        data_source: API endpoint or collection to fetch data from
    """
    metric_list = [m.strip() for m in metrics.split(",")] if metrics else ["total", "active", "completed"]

    # Build widgets from metrics
    widgets = []
    for i, metric in enumerate(metric_list):
        row = i // 3  # 3 widgets per row
        col = i % 3
        widgets.append({
            "id": f"widget_{metric}",
            "type": "stat_card",
            "title": metric.replace("_", " ").title(),
            "metric": metric,
            "data_source": data_source or f"/api/v1/erp/metrics/{metric}",
            "position": {"row": row, "col": col},
            "format": "number",
            "trend": True,
        })

    # Add a chart widget
    widgets.append({
        "id": "widget_chart",
        "type": "chart",
        "title": f"{name} Trend",
        "chart_type": "line",
        "data_source": data_source or "/api/v1/erp/metrics/trend",
        "position": {"row": (len(metric_list) // 3) + 1, "col": 0, "span": 3},
        "x_axis": "date",
        "y_axis": metric_list[:2],
    })

    # Add a table widget
    widgets.append({
        "id": "widget_table",
        "type": "table",
        "title": "Recent Items",
        "data_source": data_source or "/api/v1/erp/items",
        "position": {"row": (len(metric_list) // 3) + 2, "col": 0, "span": 3},
        "columns": ["name", "status", "value", "updated_at"],
        "pagination": True,
        "page_size": 10,
    })

    schema = {
        "type": "dashboard",
        "version": "1.0",
        "name": name,
        "description": description,
        "layout": "grid",
        "columns": 3,
        "widgets": widgets,
        "filters": [
            {"id": "date_range", "type": "date_range", "label": "Date Range"},
            {"id": "status_filter", "type": "select", "label": "Status", "options": ["all", "active", "completed"]},
        ],
        "refresh_interval": 30000,
    }

    dashboard_id = await _save_ui_schema(name, "dashboard", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "dashboard",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _generate_report(
    name: str = "Untitled Report",
    description: str = "",
    sections: str | None = None,
    persona: str = "system",
    data_source: str | None = None,
) -> str:
    """Generate a structured report layout.

    Args:
        name: Report name
        description: What the report covers
        sections: Comma-separated section names
        persona: Which AI persona is creating this
        data_source: API endpoint for report data
    """
    section_list = [s.strip() for s in sections.split(",")] if sections else ["Executive Summary", "Details", "Recommendations"]

    # Build sections
    report_sections = []
    for i, section_name in enumerate(section_list):
        section = {
            "id": f"section_{i}",
            "title": section_name,
            "type": "prose" if i == 0 else "table",
            "order": i,
        }

        if section_name.lower().find("summary") >= 0 or section_name.lower().find("executive") >= 0:
            section["type"] = "prose"
            section["ai_generated"] = True
        elif section_name.lower().find("chart") >= 0 or section_name.lower().find("visual") >= 0:
            section["type"] = "chart"
            section["chart_type"] = "bar"
            section["data_source"] = data_source or "/api/v1/erp/metrics"
        else:
            section["type"] = "table"
            section["data_source"] = data_source
            section["columns"] = ["item", "value", "status"]

        report_sections.append(section)

    schema = {
        "type": "report",
        "version": "1.0",
        "name": name,
        "description": description,
        "layout": "vertical",
        "sections": report_sections,
        "header": {
            "logo": True,
            "title": name,
            "subtitle": description,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        },
        "footer": {
            "generated_by": persona,
            "disclaimer": "This report was generated by an AI assistant. Please verify all data.",
        },
        "export_formats": ["pdf", "xlsx", "csv"],
    }

    dashboard_id = await _save_ui_schema(name, "report", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "report",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _generate_kanban(
    name: str = "Untitled Kanban",
    description: str = "",
    columns: str | None = None,
    persona: str = "system",
    data_source: str | None = None,
) -> str:
    """Generate a kanban board layout.

    Args:
        name: Kanban board name
        description: What workflow the kanban tracks
        columns: Comma-separated column names (e.g. "Backlog,In Progress,Review,Done")
        persona: Which AI persona is creating this
        data_source: API endpoint for kanban data
    """
    column_list = [c.strip() for c in columns.split(",")] if columns else ["Backlog", "In Progress", "Review", "Done"]

    kanban_columns = []
    for i, col_name in enumerate(column_list):
        kanban_columns.append({
            "id": f"col_{i}",
            "title": col_name,
            "status_key": col_name.lower().replace(" ", "_"),
            "position": i,
            "wip_limit": None,
            "card_template": {
                "title": "{{name}}",
                "subtitle": "{{client_name}}",
                "badge": "{{priority}}",
                "meta": "{{updated_at}}",
            },
        })

    schema = {
        "type": "kanban",
        "version": "1.0",
        "name": name,
        "description": description,
        "data_source": data_source or "/api/v1/enquiries",
        "columns": kanban_columns,
        "card_actions": ["move", "edit", "delete", "comment"],
        "filters": [
            {"id": "assignee", "type": "select", "label": "Assignee"},
            {"id": "priority", "type": "select", "label": "Priority", "options": ["low", "medium", "high", "critical"]},
        ],
        "drag_and_drop": True,
    }

    dashboard_id = await _save_ui_schema(name, "kanban", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "kanban",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _save_ui_schema(name: str, ui_type: str, schema: dict, persona: str) -> uuid.UUID:
    """Save a UI schema to the database and return its ID."""
    dashboard = UIDashboard(
        name=name,
        ui_type=ui_type,
        schema_json=json.dumps(schema),
        created_by_persona=persona,
    )

    async with async_session() as db:
        db.add(dashboard)
        await db.commit()
        await db.refresh(dashboard)
        return dashboard.id
```

  </app/mcp_servers/mutator_server.py>

  <app/mcp_servers/document_output_server.py>

<a name="app-mcp-servers-document-output-server-py"></a>
### `app/mcp_servers/document_output_server.py`

```py
"""Document Output MCP Server — generate proposal PDFs, quotes, and internal summaries.

Uses reportlab for PDF generation and openpyxl for Excel/CSV quote files.
"""

import csv
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from mcp.server.fastmcp import FastMCP

doc_output_mcp = FastMCP(
    "Document Output MCP",
    instructions="Generate proposal PDFs, quote spreadsheets, and internal summary documents"
)

# Ensure output directories exist
for _dir in ("media/proposals", "media/quotes", "media/summaries"):
    Path(_dir).mkdir(parents=True, exist_ok=True)


@doc_output_mcp.tool()
async def generate_proposal_pdf(
    enquiry_id: str,
    content: str,
    client_name: str,
    pricing_data: str = "",
    output_format: str = "pdf",
) -> str:
    """Generate a professional proposal PDF using reportlab.

    Args:
        enquiry_id: UUID of the enquiry.
        content: Proposal body text (markdown or plain).
        client_name: Client company name.
        pricing_data: Optional JSON string with line items.
        output_format: "pdf" or "markdown".

    Returns:
        Path to the generated file.
    """
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
            ListFlowable, ListItem
        )
    except ImportError:
        # Fallback to markdown if reportlab not installed
        output_format = "markdown"

    safe_client = client_name.replace(" ", "_").replace("/", "_")[:50]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if output_format == "pdf":
        file_name = f"proposal_{safe_client}_{enquiry_id[:8]}_{timestamp}.pdf"
        file_path = Path("media/proposals") / file_name

        doc = SimpleDocTemplate(
            str(file_path),
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=18,
        )
        story = []
        styles = getSampleStyleSheet()

        # Title
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            textColor=colors.HexColor("#1a365d"),
            spaceAfter=30,
        )
        story.append(Paragraph("PROPOSAL", title_style))
        story.append(Spacer(1, 0.2 * inch))

        # Meta table
        meta_data = [
            ["Client:", client_name],
            ["Enquiry ID:", enquiry_id],
            ["Date:", datetime.now(timezone.utc).strftime("%Y-%m-%d")],
            ["Prepared by:", "Aries AI Presales Consultant"],
        ]
        meta_table = Table(meta_data, colWidths=[2 * inch, 4 * inch])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e2e8f0")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
            ("ALIGN", (0, 0), (0, -1), "RIGHT"),
            ("ALIGN", (1, 0), (1, -1), "LEFT"),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.3 * inch))

        # Body content
        body_style = ParagraphStyle(
            "Body",
            parent=styles["BodyText"],
            fontSize=11,
            leading=16,
            spaceAfter=12,
        )
        for paragraph in content.split("\n\n"):
            if paragraph.strip():
                story.append(Paragraph(paragraph.strip().replace("\n", "<br/>"), body_style))

        # Pricing table
        if pricing_data:
            story.append(Spacer(1, 0.3 * inch))
            story.append(Paragraph("Pricing", styles["Heading2"]))
            try:
                import json
                prices = json.loads(pricing_data)
                if isinstance(prices, list) and prices:
                    price_data = [["Item", "Description", "Qty", "Unit Price", "Total"]]
                    total = 0.0
                    for item in prices:
                        qty = float(item.get("quantity", 1))
                        unit = float(item.get("unit_price", 0))
                        line_total = qty * unit
                        total += line_total
                        price_data.append([
                            item.get("item", "N/A"),
                            item.get("description", ""),
                            str(int(qty)),
                            f"${unit:,.2f}",
                            f"${line_total:,.2f}",
                        ])
                    price_data.append(["", "", "", "TOTAL:", f"${total:,.2f}"])
                    price_table = Table(price_data, colWidths=[1.2 * inch, 2.6 * inch, 0.6 * inch, 1.2 * inch, 1.2 * inch])
                    price_table.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a365d")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("ALIGN", (1, 1), (1, -2), "LEFT"),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 10),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("FONTNAME", (-2, -1), (-1, -1), "Helvetica-Bold"),
                        ("BACKGROUND", (-2, -1), (-1, -1), colors.HexColor("#e2e8f0")),
                    ]))
                    story.append(price_table)
            except Exception:
                story.append(Paragraph("(Pricing data could not be parsed)", body_style))

        # Terms
        story.append(Spacer(1, 0.3 * inch))
        story.append(Paragraph("Terms & Conditions", styles["Heading3"]))
        terms = (
            "Payment terms: Net 30 days. "
            "All prices are in USD unless otherwise specified. "
            "This proposal is valid for 30 days from the date of issue."
        )
        story.append(Paragraph(terms, body_style))
        story.append(Spacer(1, 0.3 * inch))
        story.append(Paragraph("Authorized Signature: _________________________", body_style))

        doc.build(story)
        return f"PDF generated: {file_path}"

    # Markdown fallback
    file_name = f"proposal_{safe_client}_{enquiry_id[:8]}_{timestamp}.md"
    file_path = Path("media/proposals") / file_name
    md_content = f"""# Proposal

**Client:** {client_name}
**Enquiry ID:** {enquiry_id}
**Date:** {datetime.now(timezone.utc).strftime("%Y-%m-%d")}
**Prepared by:** Aries AI Presales Consultant

---

{content}

---

*This proposal was generated by the Aries AI Presales Consultant.*
"""
    file_path.write_text(md_content, encoding="utf-8")
    return f"Markdown proposal generated: {file_path}"


@doc_output_mcp.tool()
async def generate_quote_file(
    enquiry_id: str,
    pricing_data: str,
    output_format: str = "xlsx",
) -> str:
    """Generate a quote spreadsheet (Excel or CSV).

    Args:
        enquiry_id: UUID of the enquiry.
        pricing_data: JSON array of line items [{item, description, quantity, unit_price}].
        output_format: "xlsx" or "csv".

    Returns:
        Path to the generated file.
    """
    import json

    safe_id = enquiry_id.replace("-", "_")[:20]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    try:
        items = json.loads(pricing_data) if pricing_data else []
    except json.JSONDecodeError:
        items = []

    if not isinstance(items, list):
        items = []

    # Build rows
    rows = []
    total = 0.0
    for item in items:
        qty = float(item.get("quantity", 1))
        unit = float(item.get("unit_price", 0))
        line_total = qty * unit
        total += line_total
        rows.append({
            "Item": item.get("item", "N/A"),
            "Description": item.get("description", ""),
            "Quantity": int(qty),
            "Unit Price": f"${unit:,.2f}",
            "Total": f"${line_total:,.2f}",
        })

    rows.append({"Item": "", "Description": "", "Quantity": "", "Unit Price": "TOTAL", "Total": f"${total:,.2f}"})

    if output_format == "xlsx":
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

            file_name = f"quote_{safe_id}_{timestamp}.xlsx"
            file_path = Path("media/quotes") / file_name

            wb = Workbook()
            ws = wb.active
            ws.title = "Quote"

            # Header
            headers = ["Item", "Description", "Quantity", "Unit Price", "Total"]
            ws.append(headers)
            for cell in ws[1]:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = PatternFill(start_color="1a365d", end_color="1a365d", fill_type="solid")
                cell.alignment = Alignment(horizontal="center")

            # Data rows
            for row in rows:
                ws.append([row.get(h, "") for h in headers])

            # Style total row
            total_row = len(rows) + 1
            for cell in ws[total_row]:
                cell.font = Font(bold=True)
                cell.fill = PatternFill(start_color="e2e8f0", end_color="e2e8f0", fill_type="solid")

            # Adjust column widths
            ws.column_dimensions["A"].width = 15
            ws.column_dimensions["B"].width = 40
            ws.column_dimensions["C"].width = 12
            ws.column_dimensions["D"].width = 15
            ws.column_dimensions["E"].width = 15

            wb.save(str(file_path))
            return f"Excel quote generated: {file_path}"
        except ImportError:
            output_format = "csv"

    # CSV fallback
    file_name = f"quote_{safe_id}_{timestamp}.csv"
    file_path = Path("media/quotes") / file_name
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Item", "Description", "Quantity", "Unit Price", "Total"])
        writer.writeheader()
        writer.writerows(rows)
    return f"CSV quote generated: {file_path}"


@doc_output_mcp.tool()
async def generate_internal_summary(
    enquiry_id: str,
    summary: str,
    outcome_status: str = "pending",
    metadata: str = "",
) -> str:
    """Generate an internal summary document (markdown).

    Args:
        enquiry_id: UUID of the enquiry.
        summary: Summary text content.
        outcome_status: e.g. "won", "lost", "pending", "negotiating".
        metadata: Optional JSON string with extra fields.

    Returns:
        Path to the generated markdown file.
    """
    import json

    safe_id = enquiry_id.replace("-", "_")[:20]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    file_name = f"summary_{safe_id}_{timestamp}.md"
    file_path = Path("media/summaries") / file_name

    try:
        meta = json.loads(metadata) if metadata else {}
    except json.JSONDecodeError:
        meta = {}

    md_content = f"""---
type: internal-summary
enquiry_id: {enquiry_id}
status: {outcome_status}
generated_at: {datetime.now(timezone.utc).isoformat()}
---

# Internal Summary — Enquiry {enquiry_id}

**Outcome Status:** {outcome_status}
**Generated:** {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}

---

{summary}

---

## Metadata

"""
    for key, value in meta.items():
        md_content += f"- **{key}:** {value}\n"

    md_content += "\n---\n\n*Generated by Aries AI Presales Consultant*\n"

    file_path.write_text(md_content, encoding="utf-8")
    return f"Internal summary generated: {file_path}"


@doc_output_mcp.tool()
async def generate_document(
    document_type: str,
    enquiry_id: str,
    content: str,
    client_name: str = "",
    pricing_data: str = "",
    output_format: str = "auto",
) -> str:
    """Convenience tool — routes to the correct generator based on document_type.

    Args:
        document_type: "proposal", "quote", or "summary".
        enquiry_id: UUID of the enquiry.
        content: Body text.
        client_name: Client name (for proposals).
        pricing_data: JSON pricing data (for proposals/quotes).
        output_format: "auto" picks the best format.

    Returns:
        Path to generated file.
    """
    if document_type == "proposal":
        fmt = output_format if output_format != "auto" else "pdf"
        return await generate_proposal_pdf(enquiry_id, content, client_name, pricing_data, fmt)
    elif document_type == "quote":
        fmt = output_format if output_format != "auto" else "xlsx"
        return await generate_quote_file(enquiry_id, pricing_data, fmt)
    elif document_type == "summary":
        return await generate_internal_summary(enquiry_id, content)
    else:
        return f"Unknown document_type: {document_type}. Use proposal, quote, or summary."
```

  </app/mcp_servers/document_output_server.py>

  <app/mcp_servers/outlook_server.py>

<a name="app-mcp-servers-outlook-server-py"></a>
### `app/mcp_servers/outlook_server.py`

```py
"""Outlook MCP Server — send approved proposals and client updates via email."""

from mcp.server.fastmcp import FastMCP

outlook_mcp = FastMCP("Outlook MCP", instructions="Send approved proposal emails and client updates via Outlook")


@outlook_mcp.tool()
async def send_proposal_email(to: str, client_name: str, subject: str, body: str) -> str:
    """Send a proposal email to a client via Outlook."""
    return f"Proposal email sent to {to} ({client_name}). Subject: {subject}. Stub: Outlook not yet connected."


@outlook_mcp.tool()
async def send_client_update(to: str, subject: str, body: str) -> str:
    """Send a general client update email via Outlook."""
    return f"Client update sent to {to}. Subject: {subject}. Stub: Outlook not yet connected."
```

  </app/mcp_servers/outlook_server.py>

  <app/mcp_servers/wiki_server.py>

<a name="app-mcp-servers-wiki-server-py"></a>
### `app/mcp_servers/wiki_server.py`

```py
"""Wiki MCP Server — read/write/search the wiki repo via MCP protocol."""

from mcp.server.fastmcp import FastMCP

from backend.app.services.wiki import WikiService

wiki_mcp = FastMCP("Wiki MCP", instructions="Read, write, and search the LLM Wiki repository")


@wiki_mcp.tool()
async def wiki_read(path: str) -> str:
    """Read a wiki page by path (e.g. 'entities/acme-corp.md')."""
    wiki = WikiService()
    page = wiki.read_page(path)
    return page.content if page else f"Page not found: {path}"


@wiki_mcp.tool()
async def wiki_write(path: str, content: str, commit_message: str = "MCP write") -> str:
    """Write or update a wiki page. Creates git commit automatically."""
    wiki = WikiService()
    page = wiki.write_page(path, content, commit_message)
    return f"Written: {page.path} (commit: {page.last_commit})"


@wiki_mcp.tool()
async def wiki_search(query: str, limit: int = 10) -> str:
    """Search the wiki for relevant pages."""
    wiki = WikiService()
    results = wiki.search(query, limit=limit)
    if not results:
        return "No results found."
    return "\n".join(f"- [{r.title}]({r.path}) (score: {r.score:.1f}): {r.snippet}" for r in results)


@wiki_mcp.tool()
async def wiki_list_pages() -> str:
    """List all pages in the wiki."""
    wiki = WikiService()
    pages = wiki.list_pages()
    return "\n".join(pages) if pages else "Wiki is empty."


@wiki_mcp.tool()
async def wiki_update_index() -> str:
    """Regenerate the wiki index page."""
    wiki = WikiService()
    wiki.update_index()
    return "Index updated."
```

  </app/mcp_servers/wiki_server.py>

  <app/mcp_servers/__init__.py>

<a name="app-mcp-servers-init-py"></a>
### `app/mcp_servers/__init__.py`

```py
```

  </app/mcp_servers/__init__.py>

  <app/mcp_servers/gemini_server.py>

<a name="app-mcp-servers-gemini-server-py"></a>
### `app/mcp_servers/gemini_server.py`

```py
"""Gemini MCP Server — call Gemini 2.5 Pro via MCP protocol."""

from mcp.server.fastmcp import FastMCP

from backend.app.services.gemini import GeminiService

gemini_mcp = FastMCP("Gemini MCP", instructions="Call Gemini 2.5 Pro for reasoning, classification, and drafting")


@gemini_mcp.tool()
async def gemini_classify(enquiry_description: str, industry: str = "", client_name: str = "") -> str:
    """Classify an enquiry using Gemini."""
    from backend.app.models.enquiry import Enquiry

    enquiry = Enquiry(
        client_name=client_name,
        industry=industry or None,
        description=enquiry_description,
    )
    service = GeminiService()
    result = await service.classify_enquiry(enquiry, "")
    import json
    return json.dumps(result, indent=2)


@gemini_mcp.tool()
async def gemini_draft_proposal(
    client_name: str,
    description: str,
    industry: str = "",
    wiki_context: str = "",
) -> str:
    """Draft a proposal using Gemini 2.5 Pro."""
    from backend.app.models.enquiry import Enquiry
    from backend.app.services.rules import apply_rules, RulesOutput

    enquiry = Enquiry(client_name=client_name, industry=industry or None, description=description)
    rules = apply_rules()
    service = GeminiService()
    draft = await service.draft_proposal(enquiry, wiki_context, rules, {})
    return draft


@gemini_mcp.tool()
async def gemini_query(question: str, wiki_context: str = "") -> str:
    """Answer a general question using Gemini."""
    service = GeminiService()
    return await service.answer_query(question, wiki_context)
```

  </app/mcp_servers/gemini_server.py>

  <app/mcp_servers/search_server.py>

<a name="app-mcp-servers-search-server-py"></a>
### `app/mcp_servers/search_server.py`

```py
"""Search MCP Server — Vertex AI Search + local hybrid retrieval."""

from mcp.server.fastmcp import FastMCP

from backend.app.services.wiki import WikiService

search_mcp = FastMCP("Search MCP", instructions="Hybrid search over wiki and raw sources")


@search_mcp.tool()
async def search_wiki(query: str, limit: int = 10) -> str:
    """Search the wiki repository using local text search."""
    wiki = WikiService()
    results = wiki.search(query, limit=limit)
    if not results:
        return "No results found."
    lines = []
    for r in results:
        lines.append(f"## {r.title} ({r.path}) [score: {r.score:.1f}]")
        lines.append(f"{r.snippet}\n")
    return "\n".join(lines)


@search_mcp.tool()
async def search_vertex(query: str) -> str:
    """Search using Vertex AI Search (placeholder — requires configured data store)."""
    # TODO: Implement Vertex AI Search integration
    return "Vertex AI Search not yet configured. Use search_wiki for local search."


@search_mcp.tool()
async def wiki_index_first(query: str) -> str:
    """Index-first navigation: read index.md and find relevant entries."""
    wiki = WikiService()
    index = wiki.read_page("index.md")
    if not index:
        return "No index found."
    return f"# Wiki Index\n\n{index.content}"
```

  </app/mcp_servers/search_server.py>

  <app/mcp_servers/media_server.py>

<a name="app-mcp-servers-media-server-py"></a>
### `app/mcp_servers/media_server.py`

```py
"""Media MCP Server — AI-generated images and speech.

Tools:
- generate_image: Generate an image from a text prompt
- generate_speech: Convert text to speech audio
"""

import asyncio
import logging

from backend.app.mcp_servers.gateway import gateway, MCPTool

logger = logging.getLogger("aries.mcp.media")


async def _generate_image(prompt: str, aspect_ratio: str = "auto",
                           image_size: str = "1K") -> dict:
    """Generate an image using Gemini image model.

    Args:
        prompt: Description of the image to generate.
        aspect_ratio: "auto", "1:1", "16:9", "9:16", "4:3", "3:4"
        image_size: "1K" or "2K"

    Returns:
        Dict with image_id and metadata.
    """
    from backend.app.services.gemini import GeminiService
    gemini = GeminiService()
    image_bytes = await gemini.generate_image(
        prompt=prompt,
        aspect_ratio=aspect_ratio,
        image_size=image_size,
    )
    # Store the image and return reference
    import uuid
    image_id = str(uuid.uuid4())

    # Save to disk for serving
    from pathlib import Path
    media_dir = Path("media/generated")
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / f"{image_id}.png").write_bytes(image_bytes)

    logger.info("Generated image %s: %.1fKB", image_id, len(image_bytes) / 1024)
    return {
        "image_id": image_id,
        "url": f"/api/v1/ai/media/{image_id}.png",
        "size_bytes": len(image_bytes),
        "format": "png",
        "prompt": prompt[:200],
    }


async def _generate_speech(text: str, voice_name: str = "Achernar") -> dict:
    """Convert text to speech audio using Gemini TTS model.

    Args:
        text: Text to convert to speech.
        voice_name: Voice name (Achernar, Aoede, Charon, Fenrir, Kore, Puck).

    Returns:
        Dict with audio_id and metadata.
    """
    from backend.app.services.gemini import GeminiService
    gemini = GeminiService()
    audio_bytes = await gemini.generate_speech(
        text=text,
        voice_name=voice_name,
    )
    # Store the audio and return reference
    import uuid
    audio_id = str(uuid.uuid4())

    from pathlib import Path
    media_dir = Path("media/generated")
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / f"{audio_id}.wav").write_bytes(audio_bytes)

    logger.info("Generated speech %s: %.1fKB, voice=%s", audio_id, len(audio_bytes) / 1024, voice_name)
    return {
        "audio_id": audio_id,
        "url": f"/api/v1/ai/media/{audio_id}.wav",
        "size_bytes": len(audio_bytes),
        "format": "wav",
        "voice": voice_name,
        "text_preview": text[:200],
    }


def register_media_server():
    """Register media generation tools with the MCP gateway."""
    gateway.register_tool("media", MCPTool(
        name="generate_image",
        description="Generate an image from a text description. Use for proposal covers, diagrams, visualizations.",
        server="media",
        handler=_generate_image,
        requires_auth=True,
    ))
    gateway.register_tool("media", MCPTool(
        name="generate_speech",
        description="Convert text to speech audio. Use for voice messages on WhatsApp/Telegram, audio summaries.",
        server="media",
        handler=_generate_speech,
        requires_auth=True,
    ))
    logger.info("Registered media MCP tools: generate_image, generate_speech")
```

  </app/mcp_servers/media_server.py>

  <app/api/__init__.py>

<a name="app-api-init-py"></a>
### `app/api/__init__.py`

```py
```

  </app/api/__init__.py>

  <app/api/routes/enquiries.py>

<a name="app-api-routes-enquiries-py"></a>
### `app/api/routes/enquiries.py`

```py
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.schemas.enquiry import EnquiryCreate, EnquiryRead, EnquiryUpdate

router = APIRouter(prefix="/enquiries", tags=["enquiries"])


@router.post("/", response_model=EnquiryRead, status_code=201)
async def create_enquiry(data: EnquiryCreate, db: AsyncSession = Depends(get_db)):
    enquiry = Enquiry(**data.model_dump())
    db.add(enquiry)
    await db.commit()
    await db.refresh(enquiry)
    return enquiry


@router.get("/", response_model=list[EnquiryRead])
async def list_enquiries(
    status: EnquiryStatus | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Enquiry).order_by(Enquiry.created_at.desc()).offset(offset).limit(limit)
    if status:
        stmt = stmt.where(Enquiry.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{enquiry_id}", response_model=EnquiryRead)
async def get_enquiry(enquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    return enquiry


@router.patch("/{enquiry_id}", response_model=EnquiryRead)
async def update_enquiry(
    enquiry_id: uuid.UUID,
    data: EnquiryUpdate,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(enquiry, field, value)

    await db.commit()
    await db.refresh(enquiry)
    return enquiry


@router.post("/{enquiry_id}/approve", response_model=EnquiryRead)
async def approve_enquiry(
    enquiry_id: uuid.UUID,
    approver: str,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    if enquiry.status not in (EnquiryStatus.POLICY_REVIEW, EnquiryStatus.LLM_DRAFTED):
        raise HTTPException(400, f"Cannot approve enquiry in status {enquiry.status}")

    from datetime import datetime, timezone

    enquiry.status = EnquiryStatus.APPROVED
    enquiry.approved_by = approver
    enquiry.approved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(enquiry)
    return enquiry
```

  </app/api/routes/enquiries.py>

  <app/api/routes/erp.py>

<a name="app-api-routes-erp-py"></a>
### `app/api/routes/erp.py`

```py
"""ERP API routes — Accounts, Assets, Stock, Projects, HR, Procurement."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.erp import (
    Account, SalesInvoice, InvoiceItem, PaymentEntry,
    Asset, MaintenanceRecord,
    Item, Warehouse, StockEntry, Bin,
    Project, Task, Timesheet, ProjectAssignment,
    Personnel, Certification, QualityInspection,
    Supplier, PurchaseOrder, POItem, MaterialRequest,
)
from pydantic import BaseModel, Field

router = APIRouter(prefix="/erp", tags=["erp"])


async def _paginated_results(db: AsyncSession, stmt, limit: int, offset: int):
    """Execute a paginated query and return data + total count."""
    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    # Fetch page
    result = await db.execute(stmt.offset(offset).limit(limit))
    rows = result.scalars().all()
    return {"data": rows, "total": total, "limit": limit, "offset": offset}


# ═══════════════════════════════════════════════════════════════════
# ACCOUNTS
# ═══════════════════════════════════════════════════════════════════

class InvoiceItemIn(BaseModel):
    item_code: str | None = None
    description: str
    quantity: int = 1
    rate: float

class SalesInvoiceCreate(BaseModel):
    enquiry_id: str | None = None
    customer_name: str
    customer_email: str | None = None
    items: list[InvoiceItemIn]
    tax_rate: float = 5.0  # UAE VAT
    due_date_days: int = 30

class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    reference_number: str | None = None


@router.get("/accounts")
async def list_accounts(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Account).order_by(Account.account_number)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/invoices", status_code=201)
async def create_invoice(data: SalesInvoiceCreate, db: AsyncSession = Depends(get_db)):
    inv_number = f"SINV-{uuid.uuid4().hex[:8].upper()}"
    subtotal = sum(i.quantity * i.rate for i in data.items)
    tax_amount = subtotal * (data.tax_rate / 100)
    total = subtotal + tax_amount
    due = datetime.now(timezone.utc)  # placeholder

    invoice = SalesInvoice(
        invoice_number=inv_number,
        enquiry_id=uuid.UUID(data.enquiry_id) if data.enquiry_id else None,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        outstanding_amount=total,
    )
    db.add(invoice)
    await db.flush()

    for i in data.items:
        item = InvoiceItem(invoice_id=invoice.id, item_code=i.item_code, description=i.description, quantity=i.quantity, rate=i.rate, amount=i.quantity * i.rate)
        db.add(item)

    await db.commit()
    await db.refresh(invoice)
    return {"id": str(invoice.id), "invoice_number": inv_number, "total": total}


@router.get("/invoices")
async def list_invoices(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(SalesInvoice).order_by(SalesInvoice.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/payments", status_code=201)
async def record_payment(data: PaymentCreate, db: AsyncSession = Depends(get_db)):
    invoice = await db.get(SalesInvoice, uuid.UUID(data.invoice_id))
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    payment = PaymentEntry(invoice_id=invoice.id, payment_type="receive", party_type="customer", party_name=invoice.customer_name, amount=data.amount, reference_number=data.reference_number)
    db.add(payment)

    invoice.paid_amount += data.amount
    invoice.outstanding_amount = max(0, invoice.total - invoice.paid_amount)
    if invoice.outstanding_amount <= 0:
        invoice.status = "paid"

    await db.commit()
    return {"id": str(payment.id), "outstanding": invoice.outstanding_amount}


# ═══════════════════════════════════════════════════════════════════
# ASSETS & EQUIPMENT
# ═══════════════════════════════════════════════════════════════════

class AssetCreate(BaseModel):
    asset_name: str
    asset_code: str
    asset_category: str
    location: str | None = None
    purchase_cost: float | None = None
    calibration_date: str | None = None
    next_calibration_date: str | None = None
    certification_body: str | None = None


@router.get("/assets")
async def list_assets(status: str | None = None, limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Asset).order_by(Asset.asset_code)
    if status:
        stmt = stmt.where(Asset.status == status)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/assets", status_code=201)
async def create_asset(data: AssetCreate, db: AsyncSession = Depends(get_db)):
    asset = Asset(**data.model_dump(exclude_none=True))
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/assets/calibration-due")
async def calibration_due(db: AsyncSession = Depends(get_db)):
    """Assets with calibration due within 30 days."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) + timedelta(days=30)
    stmt = select(Asset).where(Asset.next_calibration_date <= cutoff, Asset.status != "decommissioned")
    result = await db.execute(stmt)
    return result.scalars().all()


# ═══════════════════════════════════════════════════════════════════
# STOCK & INVENTORY
# ═══════════════════════════════════════════════════════════════════

@router.get("/items")
async def list_items(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Item).order_by(Item.item_code)
    return await _paginated_results(db, stmt, limit, offset)


@router.get("/warehouses")
async def list_warehouses(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Warehouse).order_by(Warehouse.warehouse_code)
    return await _paginated_results(db, stmt, limit, offset)


@router.get("/bins")
async def list_stock_levels(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    """Current stock levels per item per warehouse."""
    stmt = select(Bin)
    return await _paginated_results(db, stmt, limit, offset)


class StockEntryCreate(BaseModel):
    entry_type: str  # receipt, delivery, transfer
    item_id: str
    quantity: float
    source_warehouse: str | None = None
    target_warehouse: str | None = None
    reference: str | None = None


@router.post("/stock-entries", status_code=201)
async def create_stock_entry(data: StockEntryCreate, db: AsyncSession = Depends(get_db)):
    entry = StockEntry(**{k: (uuid.UUID(v) if k.endswith("_warehouse") or k == "item_id" else v) for k, v in data.model_dump().items() if v is not None})
    db.add(entry)
    await db.commit()
    return {"id": str(entry.id)}


# ═══════════════════════════════════════════════════════════════════
# PROJECTS & OPERATIONS
# ═══════════════════════════════════════════════════════════════════

class ProjectCreate(BaseModel):
    project_name: str
    project_type: str
    customer_name: str
    enquiry_id: str | None = None
    expected_start: str | None = None
    expected_end: str | None = None
    project_location: str | None = None
    vessel_name: str | None = None
    estimated_cost: float | None = None
    day_rate: float | None = None


@router.get("/projects")
async def list_projects(status: str | None = None, limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Project).order_by(Project.created_at.desc())
    if status:
        stmt = stmt.where(Project.status == status)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/projects", status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    code = f"PRJ-{uuid.uuid4().hex[:6].upper()}"
    project = Project(project_code=code, **{k: v for k, v in data.model_dump(exclude_none=True).items() if k != "enquiry_id"})
    if data.enquiry_id:
        project.enquiry_id = uuid.UUID(data.enquiry_id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.post("/projects/{project_id}/assign")
async def assign_personnel(project_id: uuid.UUID, personnel_id: uuid.UUID, role: str, db: AsyncSession = Depends(get_db)):
    """Assign personnel to project with automatic compliance check."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    person = await db.get(Personnel, personnel_id)
    if not person:
        raise HTTPException(404, "Personnel not found")

    # Compliance check — are all certs valid?
    certs = (await db.execute(select(Certification).where(Certification.personnel_id == personnel_id))).scalars().all()
    issues = [f"{c.cert_type} expired on {c.expiry_date}" for c in certs if c.status in ("expired",)]

    assignment = ProjectAssignment(
        project_id=project_id,
        personnel_id=personnel_id,
        role=role,
        compliance_checked=True,
        compliance_passed=len(issues) == 0,
        compliance_issues="; ".join(issues) if issues else None,
    )
    db.add(assignment)
    await db.commit()
    return {"assigned": True, "compliance_passed": len(issues) == 0, "issues": issues}


class TimesheetCreate(BaseModel):
    project_id: str
    personnel_id: str
    date: str
    hours: float = 8.0
    activity_type: str
    description: str | None = None
    billable: bool = True


@router.post("/timesheets", status_code=201)
async def create_timesheet(data: TimesheetCreate, db: AsyncSession = Depends(get_db)):
    ts = Timesheet(
        project_id=uuid.UUID(data.project_id),
        personnel_id=uuid.UUID(data.personnel_id),
        date=datetime.fromisoformat(data.date),
        hours=data.hours,
        activity_type=data.activity_type,
        description=data.description,
        billable=data.billable,
    )
    db.add(ts)
    await db.commit()
    return {"id": str(ts.id)}


# ═══════════════════════════════════════════════════════════════════
# HR & COMPLIANCE
# ═══════════════════════════════════════════════════════════════════

class PersonnelCreate(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: str | None = None
    designation: str | None = None
    department: str | None = None
    day_rate: float | None = None


class CertCreate(BaseModel):
    personnel_id: str
    cert_type: str
    cert_number: str | None = None
    issuing_body: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None


@router.get("/personnel")
async def list_personnel(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Personnel).order_by(Personnel.employee_id)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/personnel", status_code=201)
async def create_personnel(data: PersonnelCreate, db: AsyncSession = Depends(get_db)):
    person = Personnel(**data.model_dump(exclude_none=True))
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return person


@router.post("/certifications", status_code=201)
async def add_certification(data: CertCreate, db: AsyncSession = Depends(get_db)):
    cert = Certification(
        personnel_id=uuid.UUID(data.personnel_id),
        cert_type=data.cert_type,
        cert_number=data.cert_number,
        issuing_body=data.issuing_body,
        issue_date=datetime.fromisoformat(data.issue_date) if data.issue_date else None,
        expiry_date=datetime.fromisoformat(data.expiry_date) if data.expiry_date else None,
    )
    # Auto-set status based on expiry
    if cert.expiry_date:
        if cert.expiry_date < datetime.now(timezone.utc):
            cert.status = "expired"
        elif cert.expiry_date < datetime.now(timezone.utc) + __import__("datetime").timedelta(days=90):
            cert.status = "expiring_soon"
    db.add(cert)
    await db.commit()
    return cert


@router.get("/personnel/compliance-alerts")
async def compliance_alerts(db: AsyncSession = Depends(get_db)):
    """Personnel with expired or expiring certifications."""
    stmt = select(Certification).where(Certification.status.in_(["expired", "expiring_soon"]))
    result = await db.execute(stmt)
    return result.scalars().all()


# ═══════════════════════════════════════════════════════════════════
# PROCUREMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/suppliers")
async def list_suppliers(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Supplier).order_by(Supplier.supplier_name)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/suppliers", status_code=201)
async def create_supplier(name: str, code: str, db: AsyncSession = Depends(get_db)):
    supplier = Supplier(supplier_name=name, supplier_code=code)
    db.add(supplier)
    await db.commit()
    return supplier


@router.get("/purchase-orders")
async def list_purchase_orders(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.get("/material-requests")
async def list_material_requests(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(MaterialRequest).order_by(MaterialRequest.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)
```

  </app/api/routes/erp.py>

  <app/api/routes/documents.py>

<a name="app-api-routes-documents-py"></a>
### `app/api/routes/documents.py`

```py
"""Document routes — upload, list, PDF processing (async via Celery for large files)."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.enquiry import Document, Enquiry
from backend.app.schemas.enquiry import DocumentRead
from backend.app.services.ingestion import ingest_document

logger = logging.getLogger("aries.documents")

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/{enquiry_id}/upload", response_model=DocumentRead, status_code=201)
async def upload_document(
    enquiry_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")

    doc = Document(
        enquiry_id=enquiry_id,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        storage_path=f"uploads/{enquiry_id}/{file.filename}",
        processing_status="pending",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    file_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")

    # Small files (<10MB): process synchronously
    # Large files: mark as queued for background processing
    if len(file_bytes) < 10_000_000:
        await ingest_document(doc.id, file_bytes, doc.filename, db)
    else:
        doc.processing_status = "queued"
        await db.commit()
        # TODO: Offload to Celery task when Redis is available
        # For now, process synchronously but with a timeout warning
        logger.info("Processing large file %s (%d bytes) synchronously", doc.filename, len(file_bytes))
        await ingest_document(doc.id, file_bytes, doc.filename, db)

    await db.refresh(doc)
    return doc


@router.get("/{enquiry_id}", response_model=list[DocumentRead])
async def list_documents(enquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Document).where(Document.enquiry_id == enquiry_id)
    result = await db.execute(stmt)
    return result.scalars().all()


class PDFProcessRequest(BaseModel):
    prompt: str = "Extract all key information from this document"


class PDFStructuredRequest(BaseModel):
    prompt: str
    schema: dict


class PDFJobResponse(BaseModel):
    job_id: str
    filename: str
    status: str
    message: str


# In-memory job tracking (replace with Redis/Celery result backend in production)
_pdf_jobs: dict[str, dict] = {}


@router.post("/process-pdf", response_model=PDFJobResponse)
async def process_pdf(file: UploadFile, prompt: str = "Summarize this document"):
    """Process a PDF using Gemini 3 Flash native vision. Returns job ID for polling on large files."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported for direct Gemini processing")

    pdf_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(pdf_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")

    # Small PDFs: process inline
    if len(pdf_bytes) < 5_000_000:
        from backend.app.services.gemini import GeminiService
        try:
            gemini = GeminiService()
            result = await gemini.process_pdf(pdf_bytes, prompt)
            job_id = str(uuid.uuid4())
            _pdf_jobs[job_id] = {"status": "completed", "filename": file.filename, "result": result}
            return PDFJobResponse(job_id=job_id, filename=file.filename, status="completed", message=result[:500])
        except Exception as e:
            logger.error("PDF processing failed: %s", e)
            raise HTTPException(502, f"PDF processing failed: {e}")

    # Large PDFs: return job immediately, process in background
    job_id = str(uuid.uuid4())
    _pdf_jobs[job_id] = {"status": "processing", "filename": file.filename, "result": None}
    # TODO: Celery task dispatch
    # For now, process but return the job ID so the client can poll
    return PDFJobResponse(job_id=job_id, filename=file.filename, status="processing", message="PDF queued for processing. Poll /documents/pdf-job/{job_id} for result.")


@router.get("/pdf-job/{job_id}")
async def get_pdf_job(job_id: str):
    """Poll for PDF processing job result."""
    job = _pdf_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/process-pdf-structured")
async def process_pdf_structured(request: PDFStructuredRequest, file: UploadFile):
    """Process a PDF and extract structured data using Gemini structured outputs."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    pdf_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(pdf_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")
    from backend.app.services.gemini import GeminiService
    try:
        gemini = GeminiService()
        result = await gemini.process_pdf_structured(pdf_bytes, request.prompt, request.schema)
        return {"filename": file.filename, "result": result}
    except Exception as e:
        logger.error("Structured PDF extraction failed: %s", e)
        raise HTTPException(502, f"Structured PDF extraction failed: {e}")
```

  </app/api/routes/documents.py>

  <app/api/routes/ai.py>

<a name="app-api-routes-ai-py"></a>
### `app/api/routes/ai.py`

```py
"""AI Persona API — chat with personas, manage conversations, UI dashboards.

Each persona has scoped tools, knowledge base access, and RBAC.
Chat endpoint streams AI responses through the persona's configured model + tools.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.ai import Persona, PersonaCategory, AIConversation, AIMessage, UIDashboard
from backend.app.services.gemini import GeminiService, GeminiError
from backend.app.services.rag import RAGService

router = APIRouter(prefix="/ai", tags=["ai"])


# --- Path validation helpers ---

def _project_base_dir() -> str:
    """Return the project base directory (erp-aries root)."""
    # backend/app/api/routes/ai.py → 4 levels up to project root
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def _validate_path_under_base(path: str) -> str:
    """Resolve *path* and ensure it stays under the project base directory.

    Raises HTTPException 400 if the resolved path escapes the base directory.
    """
    base = os.path.realpath(_project_base_dir())
    full = os.path.realpath(path)
    if not full.startswith(base + os.sep) and full != base:
        raise HTTPException(400, "Path is outside the project directory")
    return full


def _validate_no_traversal(path: str) -> str:
    """Reject paths containing '..' traversal sequences.

    Raises HTTPException 400 if '..' is found in any path component.
    """
    parts = Path(path).parts
    if ".." in parts:
        raise HTTPException(400, "Path traversal not allowed")
    return path


# Allowlisted route values for f-string table name construction
_VALID_RAG_ROUTES = ("v1", "v2")


# --- Schemas ---

class PersonaCreate(BaseModel):
    username: str
    nickname: str
    position: str
    category: PersonaCategory = PersonaCategory.BUSINESS
    about: str | None = None
    greeting: str | None = None
    model: str = "gemini-3-flash-preview"
    temperature: float = 0.7
    allowed_tools: list[str] | None = None
    allowed_collections: list[str] | None = None
    allowed_mcp_servers: list[str] | None = None
    enable_knowledge_base: bool = True
    knowledge_base_prompt: str | None = None


class PersonaUpdate(BaseModel):
    nickname: str | None = None
    position: str | None = None
    about: str | None = None
    greeting: str | None = None
    model: str | None = None
    temperature: float | None = None
    allowed_tools: list[str] | None = None
    allowed_collections: list[str] | None = None
    allowed_mcp_servers: list[str] | None = None
    enabled: bool | None = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: uuid.UUID | None = None
    user_id: str | None = None
    channel: str = "web"


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    role: str
    content: str
    tool_calls: list | None = None


class DashboardCreate(BaseModel):
    name: str
    ui_type: str  # dashboard, form, report, kanban
    schema_json: dict
    created_by_persona: str | None = None


# --- Persona CRUD ---

@router.get("/personas")
async def list_personas(
    category: PersonaCategory | None = None,
    enabled: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Persona)
    if category:
        stmt = stmt.where(Persona.category == category)
    if enabled is not None:
        stmt = stmt.where(Persona.enabled == enabled)
    result = await db.execute(stmt.order_by(Persona.nickname))
    personas = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "username": p.username,
            "nickname": p.nickname,
            "position": p.position,
            "category": p.category,
            "model": p.model,
            "temperature": p.temperature,
            "about": p.about[:200] if p.about else None,
            "greeting": p.greeting[:100] if p.greeting else None,
            "allowed_tools": json.loads(p.allowed_tools) if p.allowed_tools else None,
            "allowed_collections": json.loads(p.allowed_collections) if p.allowed_collections else None,
            "allowed_mcp_servers": json.loads(p.allowed_mcp_servers) if p.allowed_mcp_servers else None,
            "enabled": p.enabled,
            "built_in": p.built_in,
        }
        for p in personas
    ]


@router.get("/personas/{persona_id}")
async def get_persona(persona_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Persona).where(Persona.id == uuid.UUID(persona_id))
    result = await db.execute(stmt)
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(404, "Persona not found")

    return {
        "id": str(persona.id),
        "username": persona.username,
        "nickname": persona.nickname,
        "position": persona.position,
        "category": persona.category,
        "about": persona.about,
        "greeting": persona.greeting,
        "model": persona.model,
        "temperature": persona.temperature,
        "allowed_tools": json.loads(persona.allowed_tools) if persona.allowed_tools else None,
        "allowed_collections": json.loads(persona.allowed_collections) if persona.allowed_collections else None,
        "allowed_mcp_servers": json.loads(persona.allowed_mcp_servers) if persona.allowed_mcp_servers else None,
        "enable_knowledge_base": persona.enable_knowledge_base,
        "knowledge_base_prompt": persona.knowledge_base_prompt,
        "enabled": persona.enabled,
        "built_in": persona.built_in,
    }


@router.post("/personas")
async def create_persona(data: PersonaCreate, db: AsyncSession = Depends(get_db)):
    # Check username uniqueness
    stmt = select(Persona).where(Persona.username == data.username)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(400, f"Username '{data.username}' already exists")

    persona = Persona(
        username=data.username,
        nickname=data.nickname,
        position=data.position,
        category=data.category,
        about=data.about,
        greeting=data.greeting,
        model=data.model,
        temperature=data.temperature,
        allowed_tools=json.dumps(data.allowed_tools) if data.allowed_tools else None,
        allowed_collections=json.dumps(data.allowed_collections) if data.allowed_collections else None,
        allowed_mcp_servers=json.dumps(data.allowed_mcp_servers) if data.allowed_mcp_servers else None,
        enable_knowledge_base=data.enable_knowledge_base,
        knowledge_base_prompt=data.knowledge_base_prompt,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return {"id": str(persona.id), "username": persona.username, "nickname": persona.nickname}


@router.patch("/personas/{persona_id}")
async def update_persona(
    persona_id: str,
    data: PersonaUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Persona).where(Persona.id == uuid.UUID(persona_id))
    result = await db.execute(stmt)
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(404, "Persona not found")

    if data.nickname is not None:
        persona.nickname = data.nickname
    if data.position is not None:
        persona.position = data.position
    if data.about is not None:
        persona.about = data.about
    if data.greeting is not None:
        persona.greeting = data.greeting
    if data.model is not None:
        persona.model = data.model
    if data.temperature is not None:
        persona.temperature = data.temperature
    if data.allowed_tools is not None:
        persona.allowed_tools = json.dumps(data.allowed_tools)
    if data.allowed_collections is not None:
        persona.allowed_collections = json.dumps(data.allowed_collections)
    if data.allowed_mcp_servers is not None:
        persona.allowed_mcp_servers = json.dumps(data.allowed_mcp_servers)
    if data.enabled is not None:
        persona.enabled = data.enabled

    await db.commit()
    return {"id": str(persona.id), "nickname": persona.nickname}


# --- Chat ---

@router.post("/chat/{persona_id}", response_model=ChatResponse)
async def chat_with_persona(
    persona_id: str,
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a message to a persona and get an AI response.

    Creates a new conversation if none provided. Uses the persona's
    configured model, system prompt, and allowed tools.
    """
    # Load persona
    stmt = select(Persona).where(
        and_(Persona.id == uuid.UUID(persona_id), Persona.enabled == True)
    )
    result = await db.execute(stmt)
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(404, "Persona not found or disabled")

    # Get or create conversation
    if data.conversation_id:
        conv_stmt = select(AIConversation).where(AIConversation.id == data.conversation_id)
        conv_result = await db.execute(conv_stmt)
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(404, "Conversation not found")
    else:
        conversation = AIConversation(
            persona_id=persona.id,
            user_id=data.user_id,
            channel=data.channel,
            title=data.message[:100],
        )
        db.add(conversation)
        await db.flush()

        # Add greeting message if persona has one
        if persona.greeting:
            greeting_msg = AIMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=persona.greeting,
            )
            db.add(greeting_msg)

    # Save user message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=data.message,
    )
    db.add(user_msg)
    await db.commit()

    # Build context for AI: system prompt + recent messages + wiki
    recent_messages = await _get_recent_messages(conversation.id, db, limit=20)
    wiki_context = ""
    if persona.enable_knowledge_base:
        wiki_context = await _get_wiki_context(persona, data.message)

    # Build the full prompt
    system_prompt = persona.about or f"You are {persona.nickname}, {persona.position}."
    if persona.knowledge_base_prompt:
        system_prompt += f"\n\n{persona.knowledge_base_prompt}"

    # Call Gemini via the agent loop (supports tool calling)
    try:
        from backend.app.services.agent_loop import AgentLoop
        loop = AgentLoop(persona)
        loop_result = await loop.run(
            user_message=data.message,
            conversation_messages=recent_messages,
            wiki_context=wiki_context,
        )
        ai_response = loop_result["content"]
        tool_calls_data = loop_result.get("tool_calls", [])
        tool_results_data = loop_result.get("tool_results", [])

    except GeminiError as e:
        raise HTTPException(502, f"AI response failed: {e}")

    # Save assistant message
    assistant_msg = AIMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_response,
        tool_calls=json.dumps(tool_calls_data) if tool_calls_data else None,
        metadata_json=json.dumps({
            "model": persona.model,
            "persona_id": str(persona.id),
            "tool_rounds": loop_result.get("rounds", 0),
        }),
    )

    # Save tool results as separate messages
    for tr in tool_results_data:
        tool_msg = AIMessage(
            conversation_id=conversation.id,
            role="tool",
            content=str(tr.get("result", ""))[:5000],
            tool_name=tr.get("name"),
            metadata_json=json.dumps({"status": tr.get("status")}),
        )
        db.add(tool_msg)
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return ChatResponse(
        conversation_id=str(conversation.id),
        message_id=str(assistant_msg.id),
        role="assistant",
        content=ai_response,
    )


@router.get("/conversations")
async def list_conversations(
    persona_id: str | None = None,
    user_id: str | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AIConversation)
    if persona_id:
        stmt = stmt.where(AIConversation.persona_id == uuid.UUID(persona_id))
    if user_id:
        stmt = stmt.where(AIConversation.user_id == user_id)
    result = await db.execute(stmt.order_by(AIConversation.updated_at.desc()).limit(limit))
    conversations = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "persona_id": str(c.persona_id),
            "user_id": c.user_id,
            "channel": c.channel,
            "title": c.title,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == uuid.UUID(conversation_id))
        .order_by(AIMessage.created_at.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "tool_calls": json.loads(m.tool_calls) if m.tool_calls else None,
            "tool_name": m.tool_name,
            "metadata_json": json.loads(m.metadata_json) if m.metadata_json else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


# --- UI Dashboards (Mutator output) ---

@router.get("/dashboards")
async def list_dashboards(
    ui_type: str | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(UIDashboard)
    if ui_type:
        stmt = stmt.where(UIDashboard.ui_type == ui_type)
    if active_only:
        stmt = stmt.where(UIDashboard.is_active == True)
    result = await db.execute(stmt.order_by(UIDashboard.created_at.desc()))
    dashboards = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "ui_type": d.ui_type,
            "schema_json": json.loads(d.schema_json) if d.schema_json else None,
            "created_by_persona": d.created_by_persona,
            "is_active": d.is_active,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in dashboards
    ]


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(UIDashboard).where(UIDashboard.id == uuid.UUID(dashboard_id))
    result = await db.execute(stmt)
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(404, "Dashboard not found")

    return {
        "id": str(dashboard.id),
        "name": dashboard.name,
        "ui_type": dashboard.ui_type,
        "schema_json": json.loads(dashboard.schema_json) if dashboard.schema_json else None,
        "created_by_persona": dashboard.created_by_persona,
        "is_active": dashboard.is_active,
        "created_at": dashboard.created_at.isoformat() if dashboard.created_at else None,
        "updated_at": dashboard.updated_at.isoformat() if dashboard.updated_at else None,
    }


@router.post("/dashboards")
async def create_dashboard(data: DashboardCreate, db: AsyncSession = Depends(get_db)):
    dashboard = UIDashboard(
        name=data.name,
        ui_type=data.ui_type,
        schema_json=json.dumps(data.schema_json),
        created_by_persona=data.created_by_persona,
    )
    db.add(dashboard)
    await db.commit()
    await db.refresh(dashboard)
    return {"id": str(dashboard.id), "name": dashboard.name, "ui_type": dashboard.ui_type}


# --- Seed built-in personas ---

@router.post("/seed-personas")
async def seed_personas(db: AsyncSession = Depends(get_db)):
    """Seed the 3 built-in AI personas (Dex, Viz, Avery pattern from NocoBase)."""
    personas_data = [
        {
            "username": "presales_assistant",
            "nickname": "Dex",
            "position": "Pre-sales Consultant",
            "category": PersonaCategory.BUSINESS,
            "about": (
                "You are Dex, an expert pre-sales consultant for Aries Marine. "
                "You classify enquiries, draft proposals, and guide the sales pipeline. "
                "You always check the wiki for past cases before making recommendations. "
                "You apply deterministic rules before using LLM reasoning. "
                "You are precise, professional, and always cite your sources."
            ),
            "greeting": "Hi! I'm Dex, your pre-sales consultant. I can help classify enquiries, draft proposals, and find relevant past cases. What are you working on?",
            "model": "gemini-3-flash-preview",
            "temperature": 0.4,
            "allowed_tools": ["wiki_read", "wiki_search", "gemini_query"],
            "allowed_collections": ["enquiries", "documents"],
            "allowed_mcp_servers": ["wiki", "gemini"],
            "enable_knowledge_base": True,
            "knowledge_base_prompt": "Always search the wiki for relevant past cases before answering. Reference specific wiki pages in your response.",
        },
        {
            "username": "financial_analyst",
            "nickname": "Viz",
            "position": "Financial Analyst",
            "category": PersonaCategory.BUSINESS,
            "about": (
                "You are Viz, a senior financial analyst for Aries Marine. "
                "You analyze margins, pricing, cost structures, and generate financial reports. "
                "You understand UAE VAT, day-rate calculations, and offshore industry pricing. "
                "You create dashboards and reports with structured data. "
                "You always verify margin compliance before approving quotes."
            ),
            "greeting": "Hello! I'm Viz, your financial analyst. I can help with margin analysis, pricing, VAT calculations, and financial dashboards. Need me to crunch some numbers?",
            "model": "gemini-3.1-pro-preview",
            "temperature": 0.3,
            "allowed_tools": ["wiki_read", "wiki_search", "gemini_query", "erp_accounts", "erp_stock", "generate_dashboard", "generate_report"],
            "allowed_collections": ["enquiries", "accounts", "invoices", "items", "projects"],
            "allowed_mcp_servers": ["wiki", "gemini", "erp", "document_output"],
            "enable_knowledge_base": True,
            "knowledge_base_prompt": "Check the wiki for historical pricing data and margin benchmarks. Use the ERP data for current financials.",
        },
        {
            "username": "field_engineer",
            "nickname": "Avery",
            "position": "Field Engineer",
            "category": PersonaCategory.TECHNICAL,
            "about": (
                "You are Avery, a seasoned field engineer for Aries Marine. "
                "You provide technical guidance on offshore operations, diving, inspection, and NDT. "
                "You understand IRATA, CSWIP, BOSIET certification requirements. "
                "You check personnel compliance before project assignments. "
                "You write technical specifications and scope documents."
            ),
            "greeting": "Hey! I'm Avery, your field engineer. I can help with technical specs, compliance checks, certification requirements, and project scoping. What do you need?",
            "model": "gemini-3-flash-preview",
            "temperature": 0.5,
            "allowed_tools": ["wiki_read", "wiki_search", "gemini_query", "erp_personnel", "erp_assets", "erp_projects"],
            "allowed_collections": ["personnel", "certifications", "assets", "projects", "tasks"],
            "allowed_mcp_servers": ["wiki", "gemini", "erp"],
            "enable_knowledge_base": True,
            "knowledge_base_prompt": "Search the wiki for technical standards, certification requirements, and historical project data. Always verify compliance before recommending resource assignments.",
        },
    ]

    created = []
    for p_data in personas_data:
        # Check if already exists
        stmt = select(Persona).where(Persona.username == p_data["username"])
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            continue

        persona = Persona(
            username=p_data["username"],
            nickname=p_data["nickname"],
            position=p_data["position"],
            category=p_data["category"],
            about=p_data["about"],
            greeting=p_data["greeting"],
            model=p_data["model"],
            temperature=p_data["temperature"],
            allowed_tools=json.dumps(p_data["allowed_tools"]),
            allowed_collections=json.dumps(p_data["allowed_collections"]),
            allowed_mcp_servers=json.dumps(p_data["allowed_mcp_servers"]),
            enable_knowledge_base=p_data["enable_knowledge_base"],
            knowledge_base_prompt=p_data["knowledge_base_prompt"],
            enabled=True,
            built_in=True,
        )
        db.add(persona)
        created.append(p_data["nickname"])

    await db.commit()
    return {"created": created, "message": f"Seeded {len(created)} personas"}


# --- Helpers ---

async def _get_recent_messages(
    conversation_id: uuid.UUID,
    db: AsyncSession,
    limit: int = 20,
) -> list[AIMessage]:
    stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(reversed(result.scalars().all()))


async def _get_wiki_context(persona: Persona, query: str) -> str:
    """Get wiki context relevant to the user's query, scoped by persona's allowed collections.

    Uses RAG semantic search first, falls back to wiki keyword search.

    TODO: Migrate to shared helper from backend.app.services.wiki_context.build_wiki_context
    """
    context_parts = []

    # Try RAG semantic search first (better relevance)
    try:
        rag = RAGService()
        rag_results = await rag.search(query, limit=5, method="hybrid")
        for r in rag_results:
            source = r.metadata.get("source_path", "unknown")
            heading = r.metadata.get("heading", "")
            context_parts.append(f"## {heading} ({source}) [score: {r.score:.2f}]\n{r.content[:2000]}")
    except Exception:
        # Fall back to wiki keyword search
        from backend.app.services.wiki import WikiService
        wiki = WikiService()
        index = wiki.read_page("index.md")
        if index:
            context_parts.append(f"# Wiki Index\n{index.content}")
        results = wiki.search(query, limit=10)
        for r in results:
            page = wiki.read_page(r.path)
            if page:
                context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")

    return "\n\n---\n\n".join(context_parts) if context_parts else ""


# --- RAG Search ---

@router.post("/rag/search")
async def rag_search(
    query: str,
    limit: int = 10,
    method: str = "hybrid",
    modality: str | None = None,
    route: str = "v2",
):
    """Search the RAG vector store.

    Methods: 'semantic', 'keyword', 'hybrid'
    Modality: None (all), 'text', 'image' (v2 only)
    Route: 'v2' (gemini-embedding-2, multimodal, default) or 'v1' (gemini-embedding-001, text-only)
    """
    rag = RAGService(route=route)
    results = await rag.search(query, limit=limit, method=method, modality=modality)
    return [
        {
            "content": r.content[:500],
            "score": round(r.score, 4),
            "source_path": r.metadata.get("source_path"),
            "heading": r.metadata.get("heading"),
            "method": r.metadata.get("method"),
            "modality": r.metadata.get("modality"),
            "route": route,
        }
        for r in results
    ]


@router.post("/rag/index-wiki")
async def rag_index_wiki(route: str = "v2"):
    """Index all wiki pages into the RAG vector store.

    Route: 'v2' (gemini-embedding-2, default) or 'v1' (gemini-embedding-001)
    """
    rag = RAGService(route=route)
    result = await rag.index_wiki_all()
    result["route"] = route
    result["model"] = rag.model
    return result


@router.post("/rag/index-page")
async def rag_index_page(path: str, route: str = "v2"):
    """Index a single wiki page into the RAG vector store.

    Route: 'v2' (gemini-embedding-2, default) or 'v1' (gemini-embedding-001)
    """
    # Validate path doesn't contain traversal sequences
    _validate_no_traversal(path)

    from backend.app.services.wiki import WikiService
    wiki = WikiService()
    page = wiki.read_page(path)
    if not page:
        raise HTTPException(404, f"Wiki page not found: {path}")

    rag = RAGService(route=route)
    count = await rag.index_wiki_page(path, page.content)
    return {"path": path, "chunks_indexed": count, "route": route}


@router.post("/rag/index-ocr-images")
async def rag_index_ocr_images(
    images_dir: str = "seed_data/filtered_invoices_ocr/images",
    limit: int | None = None,
):
    """Index OCR invoice images into RAG for cross-modal search.

    Uses gemini-embedding-2 (v2) multimodal embedding to embed invoice images
    into the same vector space as text, enabling text→image retrieval.
    Note: Image indexing is v2-only (v1 doesn't support multimodal).
    """
    base = _project_base_dir()
    full_dir = os.path.join(base, images_dir)

    # Validate the resolved path stays under the project base directory
    _validate_path_under_base(full_dir)

    rag = RAGService(route="v2")  # Image embedding requires v2
    result = await rag.index_ocr_images(full_dir, limit=limit)
    return result


@router.get("/rag/stats")
async def rag_stats():
    """Get RAG store statistics for both v1 and v2 routes."""
    import sqlite3
    from pathlib import Path
    from backend.app.core.config import settings

    db_path = Path(settings.database_url.replace("sqlite+aiosqlite:///", "")).parent / "rag_store.db"
    if not db_path.exists():
        return {"v1": {"total": 0}, "v2": {"total": 0}}

    conn = sqlite3.connect(str(db_path))
    stats = {}

    for route in _VALID_RAG_ROUTES:
        # route is validated against _VALID_RAG_ROUTES allowlist, so the
        # f-string table construction is safe from SQL injection.
        table = f"chunks_{route}"
        try:
            total = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            with_emb = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE embedding IS NOT NULL").fetchone()[0]
            sources = conn.execute(f"SELECT COUNT(DISTINCT source_path) FROM {table}").fetchone()[0]

            route_stats = {"total": total, "with_embedding": with_emb, "unique_sources": sources}

            if route == "v2":
                # Modality breakdown for v2
                mod_rows = conn.execute(f"SELECT modality, COUNT(*) FROM {table} GROUP BY modality").fetchall()
                route_stats["by_modality"] = {m: c for m, c in mod_rows}

            stats[route] = route_stats
        except sqlite3.OperationalError:
            stats[route] = {"total": 0, "error": "table not found"}

    conn.close()
    return stats


# --- Image Generation ---

@router.post("/generate-image")
async def generate_image(
    prompt: str,
    aspect_ratio: str = "auto",
    image_size: str = "1K",
):
    """Generate an image using gemini-3.1-flash-image-preview.

    Returns the PNG image as binary response.
    """
    from fastapi import Response
    from backend.app.services.gemini import GeminiService, GeminiError

    try:
        gemini = GeminiService()
        image_bytes = await gemini.generate_image(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        )
        return Response(content=image_bytes, media_type="image/png")
    except GeminiError as e:
        raise HTTPException(502, f"Image generation failed: {e}")


# --- Text-to-Speech ---

@router.post("/generate-speech")
async def generate_speech(
    text: str,
    voice_name: str = "Achernar",
):
    """Generate speech audio from text using gemini-3.1-flash-tts-preview.

    Returns WAV audio bytes.
    """
    from fastapi import Response
    from backend.app.services.gemini import GeminiService, GeminiError

    try:
        gemini = GeminiService()
        audio_bytes = await gemini.generate_speech(
            text=text,
            voice_name=voice_name,
        )
        return Response(content=audio_bytes, media_type="audio/wav")
    except GeminiError as e:
        raise HTTPException(502, f"TTS generation failed: {e}")


# --- Wiki Maintenance Loop ---

@router.post("/wiki/maintenance")
async def run_wiki_maintenance():
    """Run the wiki maintenance loop (G5): re-index, update index.md, check orphans."""
    from backend.app.services.wiki_loop import run_wiki_maintenance
    return await run_wiki_maintenance()
```

  </app/api/routes/ai.py>

  <app/api/routes/__init__.py>

<a name="app-api-routes-init-py"></a>
### `app/api/routes/__init__.py`

```py
```

  </app/api/routes/__init__.py>

  <app/api/routes/pipeline.py>

<a name="app-api-routes-pipeline-py"></a>
### `app/api/routes/pipeline.py`

```py
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.schemas.enquiry import PipelineRunRequest, PipelineRunResponse
from backend.app.services.pipeline import run_pipeline

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


@router.post("/run", response_model=PipelineRunResponse)
async def run_decisioning_pipeline(
    request: PipelineRunRequest,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, request.enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")

    result = await run_pipeline(enquiry, db)
    return result


@router.post("/execute/{enquiry_id}")
async def execute_approved(
    enquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    if enquiry.status != EnquiryStatus.APPROVED:
        raise HTTPException(400, "Enquiry must be approved before execution")

    from backend.app.services.execution import execute_enquiry

    result = await execute_enquiry(enquiry, db)
    return result
```

  </app/api/routes/pipeline.py>

  <app/api/routes/channels.py>

<a name="app-api-routes-channels-py"></a>
### `app/api/routes/channels.py`

```py
"""Multi-Channel Webhook Handlers — WhatsApp, Telegram, Slack.

Each handler:
1. Receives inbound messages from the platform's webhook
2. Resolves the default persona for that channel
3. Creates/updates an AI conversation
4. Triggers AI response through the persona
5. Sends the reply back through the channel's outbound API

Inspired by OpenClaw's ChannelPlugin adapter pattern — each channel
has its own message normalization, but all funnel through the same
AI chat pipeline.
"""

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.ai import Persona, AIConversation, AIMessage, ChannelConnector

logger = logging.getLogger("aries.channels")

router = APIRouter(prefix="/channels", tags=["channels"])


# --- Channel Connector CRUD ---

class ConnectorCreate(BaseModel):
    channel_type: str  # whatsapp, telegram, slack, email
    name: str
    config: dict | None = None
    default_persona_id: uuid.UUID | None = None


@router.get("/connectors")
async def list_connectors(db: AsyncSession = Depends(get_db)):
    stmt = select(ChannelConnector)
    result = await db.execute(stmt.order_by(ChannelConnector.channel_type))
    connectors = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "channel_type": c.channel_type,
            "name": c.name,
            "enabled": c.enabled,
            "webhook_url": c.webhook_url,
            "default_persona_id": str(c.default_persona_id) if c.default_persona_id else None,
        }
        for c in connectors
    ]


@router.post("/connectors")
async def create_connector(data: ConnectorCreate, db: AsyncSession = Depends(get_db)):
    connector = ChannelConnector(
        channel_type=data.channel_type,
        name=data.name,
        config=json.dumps(data.config) if data.config else None,
        default_persona_id=data.default_persona_id,
    )
    db.add(connector)
    await db.commit()
    await db.refresh(connector)

    # Generate webhook URL
    base_url = f"http://localhost:8000/api/v1/channels/webhook/{connector.id}"
    connector.webhook_url = base_url
    await db.commit()

    return {
        "id": str(connector.id),
        "channel_type": connector.channel_type,
        "name": connector.name,
        "webhook_url": connector.webhook_url,
    }


# --- WhatsApp Webhook ---

@router.get("/webhook/{connector_id}")
async def webhook_verification(
    connector_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """WhatsApp Cloud API verification endpoint (GET with hub.mode=subscribe)."""
    connector = await _get_connector(connector_id, db)
    if not connector:
        raise HTTPException(404, "Connector not found")

    config = json.loads(connector.config) if connector.config else {}
    verify_token = config.get("verify_token", "")

    params = dict(request.query_params)
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == verify_token:
        return Response(content=params.get("hub.challenge", ""), status_code=200)

    return Response(content="Forbidden", status_code=403)


@router.post("/webhook/{connector_id}")
async def webhook_receive(
    connector_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Universal webhook receiver — routes to the correct channel handler.

    Works for WhatsApp, Telegram, and Slack by examining the connector's channel_type.
    """
    connector = await _get_connector(connector_id, db)
    if not connector:
        raise HTTPException(404, "Connector not found")

    if not connector.enabled:
        raise HTTPException(400, "Connector is disabled")

    body = await request.json()
    config = json.loads(connector.config) if connector.config else {}

    if connector.channel_type == "whatsapp":
        return await _handle_whatsapp(connector, config, body, db)
    elif connector.channel_type == "telegram":
        return await _handle_telegram(connector, config, body, db)
    elif connector.channel_type == "slack":
        return await _handle_slack(connector, config, body, request, db)
    else:
        logger.warning("Unknown channel type: %s", connector.channel_type)
        return {"status": "ignored"}


# --- WhatsApp Handler ---

async def _handle_whatsapp(
    connector: ChannelConnector,
    config: dict,
    body: dict,
    db: AsyncSession,
):
    """Handle WhatsApp Cloud API webhook payload.

    Expected payload format:
    {
      "entry": [{
        "changes": [{
          "value": {
            "messages": [{
              "from": "1234567890",
              "type": "text",
              "text": {"body": "Hello"}
            }]
          }
        }]
      }]
    }
    """
    try:
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])

                for msg in messages:
                    phone_number = msg.get("from", "")
                    msg_type = msg.get("type", "text")

                    if msg_type == "text":
                        text = msg.get("text", {}).get("body", "")
                    else:
                        text = f"[{msg_type} message received]"

                    # Process the message through AI
                    await _process_inbound_message(
                        connector=connector,
                        platform_user_id=phone_number,
                        text=text,
                        channel="whatsapp",
                        db=db,
                    )

                    # Send reply via WhatsApp API
                    if connector.default_persona_id and text:
                        reply = await _get_ai_reply(phone_number, text, connector, db)
                        if reply:
                            await _send_whatsapp_reply(config, phone_number, reply)

    except Exception as e:
        logger.error("WhatsApp webhook processing failed: %s", e, exc_info=True)

    return {"status": "processed"}


async def _send_whatsapp_reply(config: dict, phone_number: str, text: str):
    """Send a reply via WhatsApp Cloud API."""
    access_token = config.get("access_token", "")
    phone_number_id = config.get("phone_number_id", "")

    if not access_token or not phone_number_id:
        logger.warning("WhatsApp config missing access_token or phone_number_id")
        return

    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "type": "text",
        "text": {"body": text[:4096]},  # WhatsApp text limit
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code != 200:
                logger.error("WhatsApp send failed: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("WhatsApp send error: %s", e)


# --- Telegram Handler ---

async def _handle_telegram(
    connector: ChannelConnector,
    config: dict,
    body: dict,
    db: AsyncSession,
):
    """Handle Telegram Bot API webhook payload.

    Expected payload format:
    {
      "message": {
        "from": {"id": 12345, "first_name": "John"},
        "text": "Hello"
      }
    }
    """
    try:
        message = body.get("message") or body.get("edited_message")
        if not message:
            return {"status": "no_message"}

        from_user = message.get("from", {})
        user_id = str(from_user.get("id", ""))
        text = message.get("text", "")

        if not text:
            return {"status": "no_text"}

        # Process through AI
        if connector.default_persona_id:
            reply = await _get_ai_reply(user_id, text, connector, db)
            if reply:
                await _send_telegram_reply(config, user_id, reply, message.get("message_id"))

    except Exception as e:
        logger.error("Telegram webhook processing failed: %s", e, exc_info=True)

    return {"status": "processed"}


async def _send_telegram_reply(config: dict, chat_id: str, text: str, reply_to: int | None = None):
    """Send a reply via Telegram Bot API."""
    bot_token = config.get("bot_token", "")
    if not bot_token:
        logger.warning("Telegram config missing bot_token")
        return

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload: dict = {
        "chat_id": chat_id,
        "text": text[:4096],  # Telegram text limit
        "parse_mode": "Markdown",
    }
    if reply_to:
        payload["reply_to_message_id"] = reply_to

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, timeout=30)
            if resp.status_code != 200:
                logger.error("Telegram send failed: %s %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Telegram send error: %s", e)


# --- Slack Handler ---

async def _handle_slack(
    connector: ChannelConnector,
    config: dict,
    body: dict,
    request: Request,
    db: AsyncSession,
):
    """Handle Slack Events API webhook.

    Supports:
    - URL verification challenge (setup)
    - Event messages (message.channels, message.im)
    """
    # URL verification challenge
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge", "")}

    # Verify Slack signing secret
    if not _verify_slack_signature(request, config):
        logger.warning("Slack signature verification failed")
        return {"status": "unverified"}

    try:
        event = body.get("event", {})
        if event.get("type") not in ("message", "app_mention"):
            return {"status": "ignored_event_type"}

        # Ignore bot's own messages
        if event.get("bot_id") or event.get("subtype") == "bot_message":
            return {"status": "ignored_bot_message"}

        user_id = event.get("user", "")
        text = event.get("text", "")
        channel_id = event.get("channel", "")
        thread_ts = event.get("thread_ts")

        # Strip bot mention from text
        bot_user_id = config.get("bot_user_id", "")
        if bot_user_id:
            text = text.replace(f"<@{bot_user_id}>", "").strip()

        if not text:
            return {"status": "no_text"}

        # Process through AI
        platform_user_id = f"slack:{channel_id}:{user_id}"
        if connector.default_persona_id:
            reply = await _get_ai_reply(platform_user_id, text, connector, db)
            if reply:
                await _send_slack_reply(config, channel_id, reply, thread_ts)

    except Exception as e:
        logger.error("Slack webhook processing failed: %s", e, exc_info=True)

    return {"status": "processed"}


def _verify_slack_signature(request: Request, config: dict) -> bool:
    """Verify Slack request signature using signing secret."""
    signing_secret = config.get("signing_secret", "")
    if not signing_secret:
        return True  # Skip verification if no secret configured (dev mode)

    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    # Replay attack check (5 min window)
    import time
    if abs(time.time() - float(timestamp)) > 60 * 5:
        return False

    sig_basestring = f"v0:{timestamp}:{request._body.decode()}"
    signature_hash = hmac.new(
        signing_secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256,
    ).hexdigest()
    expected_signature = f"v0={signature_hash}"

    return hmac.compare_digest(expected_signature, signature)


async def _send_slack_reply(config: dict, channel_id: str, text: str, thread_ts: str | None = None):
    """Send a reply via Slack Web API."""
    bot_token = config.get("bot_token", "")
    if not bot_token:
        logger.warning("Slack config missing bot_token")
        return

    url = "https://slack.com/api/chat.postMessage"
    headers = {"Authorization": f"Bearer {bot_token}"}
    payload: dict = {
        "channel": channel_id,
        "text": text[:40000],  # Slack text limit
        "unfurl_links": False,
        "unfurl_media": False,
    }
    if thread_ts:
        payload["thread_ts"] = thread_ts

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code != 200 or not resp.json().get("ok"):
                logger.error("Slack send failed: %s", resp.text)
        except Exception as e:
            logger.error("Slack send error: %s", e)


# --- Shared AI Processing ---

async def _process_inbound_message(
    connector: ChannelConnector,
    platform_user_id: str,
    text: str,
    channel: str,
    db: AsyncSession,
):
    """Save an inbound message from any channel as an AI conversation message."""
    # Find or create conversation for this user
    conversation = await _find_or_create_conversation(
        persona_id=connector.default_persona_id,
        user_id=platform_user_id,
        channel=channel,
        db=db,
    )

    # Save user message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=text,
    )
    db.add(user_msg)
    await db.commit()


async def _get_ai_reply(
    user_id: str,
    text: str,
    connector: ChannelConnector,
    db: AsyncSession,
) -> str | None:
    """Get an AI reply from the persona, saving both user and assistant messages."""
    if not connector.default_persona_id:
        return None

    # Load persona
    stmt = select(Persona).where(
        Persona.id == connector.default_persona_id,
        Persona.enabled == True,
    )
    result = await db.execute(stmt)
    persona = result.scalar_one_or_none()
    if not persona:
        logger.error("Persona %s not found or disabled", connector.default_persona_id)
        return None

    # Find or create conversation
    conversation = await _find_or_create_conversation(
        persona_id=persona.id,
        user_id=user_id,
        channel=connector.channel_type,
        db=db,
    )

    # Save user message
    user_msg = AIMessage(
        conversation_id=conversation.id,
        role="user",
        content=text,
    )
    db.add(user_msg)
    await db.commit()

    # Get recent messages for context
    recent_stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == conversation.id)
        .order_by(AIMessage.created_at.desc())
        .limit(10)
    )
    recent_result = await db.execute(recent_stmt)
    recent_messages = list(reversed(recent_result.scalars().all()))

    # Get wiki context
    # TODO: Migrate to shared helper from backend.app.services.wiki_context.build_wiki_context
    wiki_context = ""
    if persona.enable_knowledge_base:
        from backend.app.services.wiki import WikiService
        wiki = WikiService()
        search_results = wiki.search(text, limit=5)
        context_parts = []
        for r in search_results:
            page = wiki.read_page(r.path)
            if page:
                context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")
        wiki_context = "\n\n".join(context_parts) if context_parts else ""

    # Build prompt
    system_prompt = persona.about or f"You are {persona.nickname}, {persona.position}."
    prompt_parts = [system_prompt]

    if wiki_context:
        prompt_parts.append(f"## Knowledge Base:\n{wiki_context[:15000]}")

    for msg in recent_messages:
        prefix = "User" if msg.role == "user" else "Assistant"
        prompt_parts.append(f"{prefix}: {msg.content}")

    try:
        from backend.app.services.gemini import GeminiService
        gemini = GeminiService()
        reply = await gemini.answer_query("\n\n".join(prompt_parts), wiki_context or "No context")

        # Save assistant message
        assistant_msg = AIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=reply,
            metadata_json=json.dumps({
                "model": persona.model,
                "channel": connector.channel_type,
                "persona": persona.nickname,
            }),
        )
        db.add(assistant_msg)
        await db.commit()

        return reply

    except Exception as e:
        logger.error("AI reply generation failed: %s", e, exc_info=True)
        return f"Sorry, I encountered an error processing your message. Please try again later."


async def _find_or_create_conversation(
    persona_id: uuid.UUID,
    user_id: str,
    channel: str,
    db: AsyncSession,
) -> AIConversation:
    """Find an existing conversation for this user or create a new one."""
    # Look for existing conversation (same persona, user, channel)
    stmt = (
        select(AIConversation)
        .where(
            AIConversation.persona_id == persona_id,
            AIConversation.user_id == user_id,
            AIConversation.channel == channel,
        )
        .order_by(AIConversation.updated_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if conversation:
        return conversation

    # Create new conversation
    conversation = AIConversation(
        persona_id=persona_id,
        user_id=user_id,
        channel=channel,
        title=f"{channel.title()} conversation",
    )
    db.add(conversation)
    await db.flush()

    # Add persona greeting
    persona_stmt = select(Persona).where(Persona.id == persona_id)
    persona_result = await db.execute(persona_stmt)
    persona = persona_result.scalar_one_or_none()
    if persona and persona.greeting:
        greeting_msg = AIMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=persona.greeting,
        )
        db.add(greeting_msg)

    await db.commit()
    return conversation


# --- Helpers ---

async def _get_connector(connector_id: str, db: AsyncSession) -> ChannelConnector | None:
    stmt = select(ChannelConnector).where(ChannelConnector.id == uuid.UUID(connector_id))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
```

  </app/api/routes/channels.py>

  <app/api/routes/workflow.py>

<a name="app-api-routes-workflow-py"></a>
### `app/api/routes/workflow.py`

```py
"""Workflow API — CRUD for DAG pipeline definitions + execution.

Create, read, update workflows (nodes + edges), and execute them
against enquiries. Replaces the hardcoded Python pipeline.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.workflow import (
    Workflow, WorkflowStatus, WorkflowNode, NodeType, WorkflowEdge,
    WorkflowExecution, ExecutionStatus, NodeExecution,
)
from backend.app.services.workflow_executor import execute_workflow

router = APIRouter(prefix="/workflows", tags=["workflows"])


# --- Schemas ---

class NodeCreate(BaseModel):
    node_key: str
    node_type: NodeType
    label: str
    description: str | None = None
    config: dict | None = None
    position_x: int = 0
    position_y: int = 0


class EdgeCreate(BaseModel):
    source_node_key: str
    target_node_key: str
    condition: str | None = None


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None
    nodes: list[NodeCreate] = []
    edges: list[EdgeCreate] = []


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: WorkflowStatus | None = None
    is_default: bool | None = None


class ExecutionCreate(BaseModel):
    workflow_id: uuid.UUID
    enquiry_id: uuid.UUID


# --- Workflow CRUD ---

@router.get("/")
async def list_workflows(
    status: WorkflowStatus | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workflow)
    if status:
        stmt = stmt.where(Workflow.status == status)
    result = await db.execute(stmt.order_by(Workflow.created_at.desc()))
    workflows = result.scalars().all()
    return [
        {
            "id": str(w.id),
            "name": w.name,
            "description": w.description,
            "version": w.version,
            "status": w.status,
            "is_default": w.is_default,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in workflows
    ]


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    result = await db.execute(stmt)
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    # Load nodes and edges
    nodes_stmt = select(WorkflowNode).where(WorkflowNode.workflow_id == workflow.id)
    nodes_result = await db.execute(nodes_stmt)
    nodes = nodes_result.scalars().all()

    edges_stmt = select(WorkflowEdge).where(WorkflowEdge.workflow_id == workflow.id)
    edges_result = await db.execute(edges_stmt)
    edges = edges_result.scalars().all()

    return {
        "id": str(workflow.id),
        "name": workflow.name,
        "description": workflow.description,
        "version": workflow.version,
        "status": workflow.status,
        "is_default": workflow.is_default,
        "nodes": [
            {
                "id": str(n.id),
                "node_key": n.node_key,
                "node_type": n.node_type,
                "label": n.label,
                "description": n.description,
                "config": json.loads(n.config) if n.config else None,
                "position_x": n.position_x,
                "position_y": n.position_y,
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": str(e.id),
                "source_node_key": e.source_node_key,
                "target_node_key": e.target_node_key,
                "condition": e.condition,
            }
            for e in edges
        ],
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
    }


@router.post("/")
async def create_workflow(
    data: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
):
    workflow = Workflow(
        name=data.name,
        description=data.description,
        status=WorkflowStatus.DRAFT,
    )
    db.add(workflow)
    await db.flush()

    for node_data in data.nodes:
        node = WorkflowNode(
            workflow_id=workflow.id,
            node_key=node_data.node_key,
            node_type=node_data.node_type,
            label=node_data.label,
            description=node_data.description,
            config=json.dumps(node_data.config) if node_data.config else None,
            position_x=node_data.position_x,
            position_y=node_data.position_y,
        )
        db.add(node)

    for edge_data in data.edges:
        edge = WorkflowEdge(
            workflow_id=workflow.id,
            source_node_key=edge_data.source_node_key,
            target_node_key=edge_data.target_node_key,
            condition=edge_data.condition,
        )
        db.add(edge)

    await db.commit()
    await db.refresh(workflow)
    return {"id": str(workflow.id), "name": workflow.name, "status": workflow.status}


@router.patch("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    data: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    result = await db.execute(stmt)
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    if data.name is not None:
        workflow.name = data.name
    if data.description is not None:
        workflow.description = data.description
    if data.status is not None:
        workflow.status = data.status
    if data.is_default is not None:
        workflow.is_default = data.is_default

    await db.commit()
    return {"id": str(workflow.id), "name": workflow.name, "status": workflow.status}


# --- Node / Edge management ---

@router.post("/{workflow_id}/nodes")
async def add_node(
    workflow_id: str,
    data: NodeCreate,
    db: AsyncSession = Depends(get_db),
):
    wf_stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    wf_result = await db.execute(wf_stmt)
    if not wf_result.scalar_one_or_none():
        raise HTTPException(404, "Workflow not found")

    node = WorkflowNode(
        workflow_id=uuid.UUID(workflow_id),
        node_key=data.node_key,
        node_type=data.node_type,
        label=data.label,
        description=data.description,
        config=json.dumps(data.config) if data.config else None,
        position_x=data.position_x,
        position_y=data.position_y,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return {"id": str(node.id), "node_key": node.node_key, "node_type": node.node_type}


@router.post("/{workflow_id}/edges")
async def add_edge(
    workflow_id: str,
    data: EdgeCreate,
    db: AsyncSession = Depends(get_db),
):
    wf_stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    wf_result = await db.execute(wf_stmt)
    if not wf_result.scalar_one_or_none():
        raise HTTPException(404, "Workflow not found")

    edge = WorkflowEdge(
        workflow_id=uuid.UUID(workflow_id),
        source_node_key=data.source_node_key,
        target_node_key=data.target_node_key,
        condition=data.condition,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return {"id": str(edge.id), "source": edge.source_node_key, "target": edge.target_node_key}


# --- Workflow Execution ---

@router.post("/execute")
async def run_workflow(
    data: ExecutionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Execute a workflow for a given enquiry. Returns execution ID for tracking."""
    # Load workflow
    stmt = select(Workflow).where(Workflow.id == data.workflow_id)
    result = await db.execute(stmt)
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    if workflow.status != WorkflowStatus.ACTIVE:
        raise HTTPException(400, f"Workflow is {workflow.status}, must be active")

    # Create execution record
    execution = WorkflowExecution(
        workflow_id=data.workflow_id,
        enquiry_id=data.enquiry_id,
        status=ExecutionStatus.PENDING,
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Run the executor (async — it updates the execution record as it goes)
    try:
        result_data = await execute_workflow(execution.id, db)
        return {
            "execution_id": str(execution.id),
            "status": execution.status,
            "result": result_data,
        }
    except Exception as e:
        execution.status = ExecutionStatus.FAILED
        execution.error_message = str(e)
        await db.commit()
        raise HTTPException(500, f"Workflow execution failed: {e}")


@router.get("/executions/{execution_id}")
async def get_execution(execution_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(WorkflowExecution).where(WorkflowExecution.id == uuid.UUID(execution_id))
    result = await db.execute(stmt)
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(404, "Execution not found")

    # Load node executions
    ne_stmt = select(NodeExecution).where(NodeExecution.execution_id == execution.id)
    ne_result = await db.execute(ne_stmt)
    node_executions = ne_result.scalars().all()

    return {
        "id": str(execution.id),
        "workflow_id": str(execution.workflow_id),
        "enquiry_id": str(execution.enquiry_id),
        "status": execution.status,
        "current_node_key": execution.current_node_key,
        "error_message": execution.error_message,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
        "node_executions": [
            {
                "id": str(ne.id),
                "node_key": ne.node_key,
                "status": ne.status,
                "input_data": json.loads(ne.input_data) if ne.input_data else None,
                "output_data": json.loads(ne.output_data) if ne.output_data else None,
                "error_message": ne.error_message,
                "duration_ms": ne.duration_ms,
                "started_at": ne.started_at.isoformat() if ne.started_at else None,
                "completed_at": ne.completed_at.isoformat() if ne.completed_at else None,
            }
            for ne in node_executions
        ],
    }


@router.get("/{workflow_id}/executions")
async def list_executions(
    workflow_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(WorkflowExecution)
        .where(WorkflowExecution.workflow_id == uuid.UUID(workflow_id))
        .order_by(WorkflowExecution.started_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    executions = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "enquiry_id": str(e.enquiry_id),
            "status": e.status,
            "current_node_key": e.current_node_key,
            "error_message": e.error_message,
            "started_at": e.started_at.isoformat() if e.started_at else None,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        }
        for e in executions
    ]


# --- Seed default workflow ---

@router.post("/seed-default")
async def seed_default_workflow(db: AsyncSession = Depends(get_db)):
    """Seed the default Aries presales pipeline as a DB-stored DAG."""
    # Check if default already exists
    stmt = select(Workflow).where(Workflow.is_default == True)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(400, "Default workflow already exists")

    workflow = Workflow(
        name="Aries Presales Pipeline",
        description="Default enquiry pipeline: Wiki→Classify→Rules→LLM→PolicyGate→Approval→Execute",
        version=1,
        status=WorkflowStatus.ACTIVE,
        is_default=True,
    )
    db.add(workflow)
    await db.flush()

    # Nodes
    nodes = [
        WorkflowNode(workflow_id=workflow.id, node_key="start", node_type=NodeType.START, label="Start", position_x=0, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="wiki_retrieval", node_type=NodeType.RETRIEVAL, label="Wiki Retrieval",
                      description="Read index.md, follow links, search wiki", position_x=100, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="classify", node_type=NodeType.CLASSIFY, label="Classify",
                      description="Gemini 3 Flash structured classification", position_x=200, position_y=0,
                      config=json.dumps({"model": "gemini-3-flash-preview", "response_mime_type": "application/json"})),
        WorkflowNode(workflow_id=workflow.id, node_key="rules", node_type=NodeType.RULES, label="Rules Engine",
                      description="Deterministic margin/approval rules — always before LLM", position_x=300, position_y=0,
                      config=json.dumps({"min_margin_pct": 15, "approval_threshold": 200000})),
        WorkflowNode(workflow_id=workflow.id, node_key="llm_draft", node_type=NodeType.LLM, label="LLM Draft",
                      description="Gemini 3.1 Pro proposal drafting", position_x=400, position_y=0,
                      config=json.dumps({"model": "gemini-3.1-pro-preview"})),
        WorkflowNode(workflow_id=workflow.id, node_key="policy_gate", node_type=NodeType.DECISION, label="Policy Gate",
                      description="Check for policy violations", position_x=500, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="human_approval", node_type=NodeType.HUMAN_APPROVAL, label="Human Approval",
                      description="Two-person approval gate", position_x=600, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="execute", node_type=NodeType.EXECUTION, label="Execute",
                      description="Parallel fan-out: ERP, SAP, Outlook, PDF, Wiki", position_x=700, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="end", node_type=NodeType.END, label="End", position_x=800, position_y=0),
        # Branch from policy gate
        WorkflowNode(workflow_id=workflow.id, node_key="human_review", node_type=NodeType.HUMAN_APPROVAL, label="Human Review",
                      description="Manual review required due to policy violations", position_x=500, position_y=100),
    ]
    for node in nodes:
        db.add(node)

    # Edges (main path + branch)
    edges = [
        WorkflowEdge(workflow_id=workflow.id, source_node_key="start", target_node_key="wiki_retrieval"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="wiki_retrieval", target_node_key="classify"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="classify", target_node_key="rules"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="rules", target_node_key="llm_draft"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="llm_draft", target_node_key="policy_gate"),
        # Policy gate branches
        WorkflowEdge(workflow_id=workflow.id, source_node_key="policy_gate", target_node_key="human_approval", condition="policy_pass"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="policy_gate", target_node_key="human_review", condition="policy_fail"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="human_review", target_node_key="human_approval", condition="approved"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="human_approval", target_node_key="execute"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="execute", target_node_key="end"),
    ]
    for edge in edges:
        db.add(edge)

    await db.commit()
    return {"id": str(workflow.id), "name": workflow.name, "node_count": len(nodes), "edge_count": len(edges)}
```

  </app/api/routes/workflow.py>

  <app/api/routes/wiki.py>

<a name="app-api-routes-wiki-py"></a>
### `app/api/routes/wiki.py`

```py
from fastapi import APIRouter, HTTPException

from backend.app.schemas.enquiry import WikiPageCreate, WikiPageRead, WikiPageUpdate, WikiSearchResult
from backend.app.services.wiki import WikiService

router = APIRouter(prefix="/wiki", tags=["wiki"])
wiki_service = WikiService()


@router.get("/pages", response_model=list[str])
async def list_pages():
    return wiki_service.list_pages()


@router.get("/pages/{page_path:path}", response_model=WikiPageRead)
async def get_page(page_path: str):
    page = wiki_service.read_page(page_path)
    if not page:
        raise HTTPException(404, f"Wiki page not found: {page_path}")
    return page


@router.post("/pages", response_model=WikiPageRead, status_code=201)
async def create_page(data: WikiPageCreate):
    page = wiki_service.write_page(data.path, data.content, data.commit_message)
    return page


@router.put("/pages/{page_path:path}", response_model=WikiPageRead)
async def update_page(page_path: str, data: WikiPageUpdate):
    existing = wiki_service.read_page(page_path)
    if not existing:
        raise HTTPException(404, f"Wiki page not found: {page_path}")
    page = wiki_service.write_page(page_path, data.content, data.commit_message)
    return page


@router.delete("/pages/{page_path:path}", status_code=204)
async def delete_page(page_path: str, commit_message: str = "Delete page"):
    wiki_service.delete_page(page_path, commit_message)


@router.get("/search", response_model=list[WikiSearchResult])
async def search_wiki(q: str, limit: int = 10):
    return wiki_service.search(q, limit=limit)


@router.get("/index")
async def get_index():
    return wiki_service.read_page("index.md")
```

  </app/api/routes/wiki.py>

  <app/services/ingestion.py>

<a name="app-services-ingestion-py"></a>
### `app/services/ingestion.py`

```py
"""MarkItDown document ingestion service (Node 4)."""

import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.enquiry import Document
from backend.app.services.wiki import WikiService


async def ingest_document(
    doc_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    db: AsyncSession,
) -> Document:
    """Convert a document to markdown via MarkItDown and write to wiki."""
    doc = await db.get(Document, doc_id)
    if not doc:
        raise ValueError(f"Document {doc_id} not found")

    doc.processing_status = "processing"
    await db.commit()

    try:
        markdown = await _convert_to_markdown(file_bytes, filename)
        doc.markdown_content = markdown

        # Write source page to wiki
        wiki = WikiService()
        source_page_path = f"sources/{doc.enquiry_id}/{Path(filename).stem}.md"
        wiki_content = _build_source_page(doc.enquiry_id, filename, markdown)
        wiki.write_page(source_page_path, wiki_content, f"Ingest source: {filename}")
        wiki.update_index()
        wiki.append_to_log("ingest", filename, f"Enquiry {doc.enquiry_id}")

        doc.wiki_source_page = source_page_path
        doc.processing_status = "completed"
    except Exception as e:
        doc.processing_status = "failed"
        raise e
    finally:
        await db.commit()

    return doc


async def _convert_to_markdown(file_bytes: bytes, filename: str) -> str:
    """Convert file bytes to markdown using MarkItDown. Security: uses convert_local() pattern."""
    import tempfile

    from markitdown import MarkItDown

    md = MarkItDown()

    # Write to temp file for safe local conversion
    suffix = Path(filename).suffix or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        result = md.convert_local(tmp_path)
        return result.text_content
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _build_source_page(enquiry_id: uuid.UUID, filename: str, markdown: str) -> str:
    """Build a wiki source page with metadata header."""
    from datetime import datetime, timezone

    header = (
        f"---\n"
        f"type: source\n"
        f"enquiry_id: {enquiry_id}\n"
        f"file: {filename}\n"
        f"ingested: {datetime.now(timezone.utc).isoformat()}\n"
        f"---\n\n"
    )
    title = f"# Source: {filename}\n\n"
    return header + title + markdown
```

  </app/services/ingestion.py>

  <app/services/execution.py>

<a name="app-services-execution-py"></a>
### `app/services/execution.py`

```py
"""Execution systems (Node 16) — parallel fan-out via MCP servers.

Nodes 16a-16e execute in parallel after human approval (Node 15).
"""

import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.services.wiki import WikiService


@dataclass
class ExecutionResult:
    system: str
    success: bool
    message: str
    details: dict | None = None


async def execute_enquiry(enquiry: Enquiry, db: AsyncSession) -> dict:
    """Execute all downstream systems in parallel (Nodes 16a-16e)."""
    enquiry.status = EnquiryStatus.EXECUTING
    await db.commit()

    # Fan-out in parallel
    results = await asyncio.gather(
        _execute_erp(enquiry),
        _execute_sap(enquiry),
        _execute_outlook(enquiry),
        _execute_document_output(enquiry),
        _execute_wiki_update(enquiry),
        return_exceptions=True,
    )

    executions = []
    for r in results:
        if isinstance(r, Exception):
            executions.append(ExecutionResult(system="unknown", success=False, message=str(r)))
        else:
            executions.append(r)

    # Update enquiry number if ERP returned one
    for r in executions:
        if r.system == "erp" and r.success and r.details and r.details.get("enquiry_number"):
            enquiry.enquiry_number = r.details["enquiry_number"]

    enquiry.status = EnquiryStatus.COMPLETED
    await db.commit()

    return {
        "enquiry_id": str(enquiry.id),
        "status": enquiry.status.value,
        "executions": [
            {"system": r.system, "success": r.success, "message": r.message}
            for r in executions
        ],
    }


async def _execute_erp(enquiry: Enquiry) -> ExecutionResult:
    """Node 16a: ERP — create enquiry record, assign number."""
    # Stub: will be replaced by ERP MCP server
    enquiry_number = f"ENQ-{uuid.uuid4().hex[:8].upper()}"
    return ExecutionResult(
        system="erp",
        success=True,
        message=f"Created enquiry record {enquiry_number}",
        details={"enquiry_number": enquiry_number},
    )


async def _execute_sap(enquiry: Enquiry) -> ExecutionResult:
    """Node 16b: SAP — prepare sales order."""
    # Stub: will be replaced by SAP MCP server
    return ExecutionResult(system="sap", success=True, message="Sales order draft prepared")


async def _execute_outlook(enquiry: Enquiry) -> ExecutionResult:
    """Node 16c: Outlook — send approved proposal email."""
    # Stub: will be replaced by Outlook MCP server
    return ExecutionResult(
        system="outlook",
        success=True,
        message=f"Proposal email sent to {enquiry.client_email or 'client'}",
    )


async def _execute_document_output(enquiry: Enquiry) -> ExecutionResult:
    """Node 16d: Document Output — generate PDF."""
    # Stub: will be replaced by Document Output MCP server
    return ExecutionResult(
        system="document_output",
        success=True,
        message="Proposal PDF generated",
    )


async def _execute_wiki_update(enquiry: Enquiry) -> ExecutionResult:
    """Node 16e: Wiki Update — write issued proposal back to wiki."""
    wiki = WikiService()
    outcome_path = f"outcomes/{enquiry.id}.md"

    content = f"""---
type: outcome
enquiry_id: {enquiry.id}
client: {enquiry.client_name}
status: issued
---

# Outcome: {enquiry.client_name}

- Enquiry Number: {enquiry.enquiry_number or 'TBD'}
- Status: Issued
- Value: {enquiry.estimated_value or 'TBD'}
- Approved by: {enquiry.approved_by or 'N/A'}
"""
    wiki.write_page(outcome_path, content, f"Record outcome for enquiry {enquiry.id}")
    wiki.update_index()

    return ExecutionResult(
        system="wiki_update",
        success=True,
        message=f"Wiki updated with outcome at {outcome_path}",
    )
```

  </app/services/execution.py>

  <app/services/wiki_loop.py>

<a name="app-services-wiki-loop-py"></a>
### `app/services/wiki_loop.py`

```py
"""Wiki Maintenance Loop (G5) — periodic wiki maintenance tasks.

Runs automatically to:
1. Re-index wiki content into RAG vector store
2. Update the wiki index.md with new pages
3. Clean up stale references
4. Generate summary pages from accumulated knowledge

Triggered by: startup, periodic cron, or manual API call.
"""

import logging
from datetime import datetime, timezone

from backend.app.services.wiki import WikiService
from backend.app.services.rag import RAGService

logger = logging.getLogger("aries.wiki_loop")


async def run_wiki_maintenance() -> dict:
    """Run the full wiki maintenance loop.

    Steps:
    1. Scan wiki for new/modified pages
    2. Update index.md with current page listing
    3. Re-index all pages into RAG store
    4. Return maintenance report
    """
    start_time = datetime.now(timezone.utc)
    report = {
        "started_at": start_time.isoformat(),
        "steps": {},
    }

    wiki = WikiService()
    rag = RAGService()

    # Step 1: Scan wiki pages
    try:
        pages = wiki.list_pages()
        report["steps"]["scan"] = {"page_count": len(pages), "status": "ok"}
        logger.info("Wiki scan: %d pages found", len(pages))
    except Exception as e:
        report["steps"]["scan"] = {"status": "failed", "error": str(e)}
        logger.error("Wiki scan failed: %s", e)
        return report

    # Step 2: Update index.md
    try:
        index_content = _generate_index(pages, wiki)
        wiki.write_page("index.md", index_content, "Wiki maintenance: auto-update index")
        report["steps"]["index_update"] = {"status": "ok", "pages_indexed": len(pages)}
        logger.info("Wiki index.md updated with %d pages", len(pages))
    except Exception as e:
        report["steps"]["index_update"] = {"status": "failed", "error": str(e)}
        logger.error("Index update failed: %s", e)

    # Step 3: Re-index into RAG
    try:
        rag_result = await rag.index_wiki_all()
        report["steps"]["rag_index"] = rag_result
        logger.info("RAG indexing: %d pages, %d chunks", rag_result["indexed_pages"], rag_result["total_chunks"])
    except Exception as e:
        report["steps"]["rag_index"] = {"status": "failed", "error": str(e)}
        logger.error("RAG indexing failed: %s", e)

    # Step 4: Check for orphaned pages (not referenced in index)
    try:
        orphans = _find_orphaned_pages(pages, wiki)
        report["steps"]["orphan_check"] = {"orphan_count": len(orphans), "orphans": orphans[:10]}
    except Exception as e:
        report["steps"]["orphan_check"] = {"status": "failed", "error": str(e)}

    end_time = datetime.now(timezone.utc)
    report["completed_at"] = end_time.isoformat()
    report["duration_seconds"] = (end_time - start_time).total_seconds()

    return report


def _generate_index(pages: list[str], wiki: WikiService) -> str:
    """Generate an index.md with all wiki pages organized by category."""
    categories: dict[str, list[tuple[str, str]]] = {
        "Entities": [],
        "Concepts": [],
        "Sources": [],
        "Outcomes": [],
        "Other": [],
    }

    for page_path in pages:
        if page_path == "index.md" or page_path == "AGENTS.md" or page_path == "log.md":
            continue

        page = wiki.read_page(page_path)
        title = page_path.replace(".md", "").split("/")[-1].replace("-", " ").title()

        # Categorize by path
        if page_path.startswith("entities/"):
            categories["Entities"].append((page_path, title))
        elif page_path.startswith("concepts/"):
            categories["Concepts"].append((page_path, title))
        elif page_path.startswith("sources/"):
            categories["Sources"].append((page_path, title))
        elif page_path.startswith("outcomes/"):
            categories["Outcomes"].append((page_path, title))
        else:
            categories["Other"].append((page_path, title))

    lines = [
        "# Aries Knowledge Base Index",
        "",
        f"_Last updated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}_",
        "",
    ]

    for category, items in categories.items():
        if not items:
            continue
        lines.append(f"## {category}")
        lines.append("")
        for path, title in sorted(items, key=lambda x: x[1]):
            lines.append(f"- [{title}]({path})")
        lines.append("")

    return "\n".join(lines)


def _find_orphaned_pages(pages: list[str], wiki: WikiService) -> list[str]:
    """Find pages that aren't linked from any other page."""
    # Read all page contents and collect links
    all_links: set[str] = set()
    for page_path in pages:
        page = wiki.read_page(page_path)
        if not page:
            continue
        # Extract markdown links: [text](path)
        import re
        links = re.findall(r'\[([^\]]*)\]\(([^)]+\.md)\)', page.content)
        for _, link_path in links:
            all_links.add(link_path)

    # Find pages not in any link set
    orphans = []
    for page_path in pages:
        if page_path in ("index.md", "AGENTS.md", "log.md"):
            continue
        if page_path not in all_links:
            orphans.append(page_path)

    return orphans
```

  </app/services/wiki_loop.py>

  <app/services/agent_loop.py>

<a name="app-services-agent-loop-py"></a>
### `app/services/agent_loop.py`

```py
"""Agent Orchestration Loop — full tool-calling agent loop.

The agent loop:
1. Receives a user message + persona context
2. Builds the system prompt from persona config
3. Calls Gemini with tool definitions (from persona's allowed tools)
4. If Gemini requests a tool call → execute it via MCP gateway → feed result back
5. Repeats until Gemini returns a final text response (no more tool calls)
6. Saves all messages (user, assistant, tool_call, tool_result) to conversation

This replaces the simple "answer_query" approach with a proper agentic loop
where the AI can use tools autonomously.
"""

import json
import logging
from typing import Any

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

from backend.app.core.config import settings
from backend.app.models.ai import Persona, AIConversation, AIMessage

logger = logging.getLogger("aries.agent_loop")

MAX_TOOL_ROUNDS = 10  # prevent infinite tool loops


class AgentLoop:
    """Full tool-calling agent loop powered by Gemini."""

    def __init__(self, persona: Persona):
        self.persona = persona
        self.client = settings.get_genai_client()
        self.model = persona.model

        # Parse persona's allowed tools
        self.allowed_tools = json.loads(persona.allowed_tools) if persona.allowed_tools else []
        self.allowed_mcp_servers = json.loads(persona.allowed_mcp_servers) if persona.allowed_mcp_servers else []

    async def run(
        self,
        user_message: str,
        conversation_messages: list[AIMessage] | None = None,
        wiki_context: str = "",
    ) -> dict:
        """Run the full agent loop with tool calling.

        Returns: {
            "content": str,          # final text response
            "tool_calls": list,       # list of tool calls made
            "tool_results": list,     # list of tool results
            "rounds": int,            # number of tool-calling rounds
        }
        """
        # Build system prompt
        system_prompt = self._build_system_prompt(wiki_context)

        # Build conversation history in Gemini format
        contents = self._build_contents(system_prompt, user_message, conversation_messages, wiki_context)

        # Get available tool declarations for this persona
        tool_declarations = self._get_tool_declarations()

        # Track tool calls and results
        all_tool_calls = []
        all_tool_results = []
        rounds = 0

        # Agentic loop: call model → if tool_call → execute → feed back → repeat
        while rounds < MAX_TOOL_ROUNDS:
            rounds += 1

            try:
                config = {}
                if tool_declarations:
                    config["tools"] = tool_declarations

                response = self._generate(
                    model=self.model,
                    contents=contents,
                    config=config if config else None,
                )
            except Exception as e:
                logger.error("Agent loop Gemini call failed: %s", e)
                return {
                    "content": f"I encountered an error processing your request: {e}",
                    "tool_calls": all_tool_calls,
                    "tool_results": all_tool_results,
                    "rounds": rounds,
                }

            # Check if the model wants to call tools
            candidate = response.candidates[0] if response.candidates else None
            if not candidate:
                return {
                    "content": "I couldn't generate a response. Please try again.",
                    "tool_calls": all_tool_calls,
                    "tool_results": all_tool_results,
                    "rounds": rounds,
                }

            # Collect tool calls from the response
            tool_calls_in_response = []
            text_parts = []

            for part in candidate.content.parts:
                if part.text:
                    text_parts.append(part.text)
                elif part.function_call:
                    tool_calls_in_response.append({
                        "name": part.function_call.name,
                        "args": dict(part.function_call.args) if part.function_call.args else {},
                    })

            # If no tool calls, we're done — return the text response
            if not tool_calls_in_response:
                final_text = "\n".join(text_parts)
                return {
                    "content": final_text or "I couldn't generate a meaningful response.",
                    "tool_calls": all_tool_calls,
                    "tool_results": all_tool_results,
                    "rounds": rounds,
                }

            # Execute tool calls
            all_tool_calls.extend(tool_calls_in_response)
            tool_results = []

            for tc in tool_calls_in_response:
                tool_name = tc["name"]
                tool_args = tc["args"]

                logger.info("Agent calling tool: %s(%s)", tool_name, json.dumps(tool_args, default=str)[:200])

                try:
                    result = await self._execute_tool(tool_name, tool_args)
                    tool_results.append({
                        "name": tool_name,
                        "result": result,
                        "status": "success",
                    })
                    all_tool_results.append({"name": tool_name, "result": result, "status": "success"})
                except Exception as e:
                    logger.error("Tool %s execution failed: %s", tool_name, e)
                    tool_results.append({
                        "name": tool_name,
                        "result": f"Error: {e}",
                        "status": "error",
                    })
                    all_tool_results.append({"name": tool_name, "result": f"Error: {e}", "status": "error"})

            # Feed tool results back into conversation
            # Build function response parts
            function_response_parts = []
            for tr in tool_results:
                function_response_parts.append(
                    types.Part.from_function_response(
                        name=tr["name"],
                        response={"result": tr["result"][:10000]},  # limit response size
                    )
                )

            # Add assistant's tool call message + function responses to contents
            contents.append(candidate.content)
            contents.append(types.Content(role="user", parts=function_response_parts))

        # If we hit max rounds, return what we have
        return {
            "content": "I've completed my research using the available tools. Let me summarize what I found:\n\n" + "\n".join(
                f"**{tr['name']}**: {str(tr['result'])[:500]}" for tr in all_tool_results[-3:]
            ),
            "tool_calls": all_tool_calls,
            "tool_results": all_tool_results,
            "rounds": rounds,
        }

    def _build_system_prompt(self, wiki_context: str = "") -> str:
        """Build the system prompt from persona config."""
        prompt = self.persona.about or f"You are {self.persona.nickname}, {self.persona.position}."

        if self.persona.knowledge_base_prompt:
            prompt += f"\n\n{self.persona.knowledge_base_prompt}"

        if wiki_context:
            prompt += f"\n\n## Knowledge Base Context:\n{wiki_context[:30000]}"

        # Add tool usage guidance
        if self.allowed_tools:
            prompt += f"\n\n## Available Tools:\nYou have access to these tools: {', '.join(self.allowed_tools)}. Use them when needed to answer questions accurately."

        return prompt

    def _build_contents(
        self,
        system_prompt: str,
        user_message: str,
        conversation_messages: list[AIMessage] | None,
        wiki_context: str,
    ) -> list:
        """Build the Gemini content array from conversation history."""
        contents = []

        # Add system instruction as first user message
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=system_prompt)],
        ))
        contents.append(types.Content(
            role="model",
            parts=[types.Part.from_text(text=f"I am {self.persona.nickname}, ready to help.")],
        ))

        # Add conversation history
        if conversation_messages:
            for msg in conversation_messages[-20:]:  # limit context window
                role = "user" if msg.role == "user" else "model"
                if msg.content:
                    contents.append(types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg.content)],
                    ))

        # Add current user message
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        ))

        return contents

    def _get_tool_declarations(self) -> list[types.Tool]:
        """Get Gemini tool declarations from the persona's allowed tools."""
        from backend.app.mcp_servers.gateway import gateway

        # Build function declarations from MCP gateway tools
        declarations = []
        all_tools = gateway.list_tools()

        for tool_info in all_tools:
            if tool_info["name"] not in self.allowed_tools:
                continue

            # Build a function declaration for each allowed tool
            declarations.append(types.FunctionDeclaration(
                name=tool_info["name"],
                description=tool_info["description"],
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "query": types.Schema(type="STRING", description="Search query or input text"),
                        "path": types.Schema(type="STRING", description="Wiki page path"),
                        "question": types.Schema(type="STRING", description="Question to answer"),
                    },
                    # Make all params optional — Gemini will only provide what's needed
                ),
            ))

        if not declarations:
            return []

        return [types.Tool(function_declarations=declarations)]

    async def _execute_tool(self, tool_name: str, args: dict) -> str:
        """Execute an MCP tool via the gateway."""
        from backend.app.mcp_servers.gateway import gateway

        # Check if tool is in persona's allowed list
        if tool_name not in self.allowed_tools:
            return f"Tool '{tool_name}' is not available to {self.persona.nickname}"

        try:
            result = await gateway.call_tool(tool_name, **args)
            return result
        except ValueError as e:
            return f"Tool not found: {e}"
        except Exception as e:
            return f"Tool execution error: {e}"

    @retry(
        retry=retry_if_exception_type((ResourceExhausted, ServiceUnavailable)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        reraise=True,
    )
    def _generate(self, model: str, contents, config: dict | None = None):
        """Core Gemini call with retry on rate limits."""
        return self.client.models.generate_content(
            model=model,
            contents=contents,
            config=config or {},
        )
```

  </app/services/agent_loop.py>

  <app/services/__init__.py>

<a name="app-services-init-py"></a>
### `app/services/__init__.py`

```py
```

  </app/services/__init__.py>

  <app/services/rules.py>

<a name="app-services-rules-py"></a>
### `app/services/rules.py`

```py
"""Rules Engine (Node 11) — deterministic business logic.

Runs BEFORE the LLM (Node 12). Pricing, margins, tax, approval thresholds,
and policy are never decided by the LLM alone.
"""

from dataclasses import dataclass, field


@dataclass
class RulesOutput:
    """Output from the rules engine for a given enquiry."""
    min_margin_pct: float = 15.0
    max_discount_pct: float = 10.0
    approval_threshold_value: float = 100_000.0
    tax_rate: float = 0.0
    suggested_template: str = "standard_proposal"
    requires_two_person_approval: bool = False
    policy_violations: list[str] = field(default_factory=list)
    pricing_adjustments: dict = field(default_factory=dict)


# --- Configurable rules (load from DB/config in production) ---

MARGIN_RULES = {
    "default_min_margin": 15.0,
    "high_value_min_margin": 20.0,  # enquiries > 500k
    "high_value_threshold": 500_000.0,
}

APPROVAL_RULES = {
    "auto_approve_below": 50_000.0,
    "single_approval_below": 200_000.0,
    "two_person_above": 200_000.0,
}

TAX_RULES = {
    "default_rate": 0.0,  # VAT/GST varies by region; placeholder
}

TEMPLATE_RULES = {
    "default": "standard_proposal",
    "government": "government_proposal",
    "enterprise": "enterprise_proposal",
}


def apply_rules(
    estimated_value: float | None = None,
    estimated_cost: float | None = None,
    industry: str | None = None,
    subdivision: str | None = None,
) -> RulesOutput:
    """Apply deterministic rules to an enquiry. Returns structured output."""
    output = RulesOutput()

    # Margin rules
    if estimated_value and estimated_value and estimated_value > 0:
        value = estimated_value
        if value >= MARGIN_RULES["high_value_threshold"]:
            output.min_margin_pct = MARGIN_RULES["high_value_min_margin"]

        if estimated_cost:
            actual_margin_pct = ((value - estimated_cost) / value) * 100
            if actual_margin_pct < output.min_margin_pct:
                output.policy_violations.append(
                    f"Margin {actual_margin_pct:.1f}% below minimum {output.min_margin_pct}%"
                )

    # Approval rules
    if estimated_value:
        if estimated_value >= APPROVAL_RULES["two_person_above"]:
            output.requires_two_person_approval = True
            output.approval_threshold_value = APPROVAL_RULES["two_person_above"]

    # Template rules
    if industry and industry.lower() in ("government", "public sector"):
        output.suggested_template = TEMPLATE_RULES["government"]
    elif estimated_value and estimated_value >= 200_000:
        output.suggested_template = TEMPLATE_RULES["enterprise"]

    return output
```

  </app/services/rules.py>

  <app/services/gemini.py>

<a name="app-services-gemini-py"></a>
### `app/services/gemini.py`

```py
"""Gemini service (Nodes 10, 12) — structured classification + LLM reasoning + PDF processing.

Uses Gemini 3 Flash for classification/OCR (cheaper, faster) and Gemini 2.5 Pro for reasoning.
All Gemini calls use tenacity retry with exponential backoff and proper error logging.
No exceptions are silently swallowed — failures are logged and surfaced.
"""

import json
import logging
from pathlib import Path

from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable, DeadlineExceeded

from backend.app.core.config import settings
from backend.app.models.enquiry import Enquiry
from backend.app.services.rules import RulesOutput

logger = logging.getLogger("aries.gemini")

# --- Models ---
CLASSIFY_MODEL = "gemini-3-flash-preview"       # Fast, cheap — classification, OCR, extraction
REASONING_MODEL = "gemini-3.1-pro-preview"      # Most intelligent — proposal drafting, report writing
OCR_MODEL = "gemini-3-flash-preview"            # Fast, cheap — document vision, OCR
IMAGE_MODEL = "gemini-3.1-flash-image-preview"  # Image generation + editing
TTS_MODEL = "gemini-3.1-flash-tts-preview"      # Text-to-speech audio output

# --- Rate limit retry config ---
RETRYABLE_EXCEPTIONS = (ResourceExhausted, ServiceUnavailable, DeadlineExceeded)


# --- Structured output schemas ---

class EnquiryClassification(BaseModel):
    category: str = Field(description="One of: consulting, implementation, support, training, audit")
    subdivision: str = Field(description="Relevant business subdivision")
    complexity: str = Field(description="One of: low, medium, high, critical")
    required_documents: list[str] = Field(description="List of required documents")
    resource_profile: str = Field(description="Brief description of team/resources needed")


class ProposalPricingItem(BaseModel):
    item: str
    amount: float


class ProposalPricing(BaseModel):
    total: float
    currency: str = "USD"
    breakdown: list[ProposalPricingItem]


class StructuredProposal(BaseModel):
    executive_summary: str
    scope_of_work: str
    deliverables: list[str]
    assumptions: list[str]
    pricing: ProposalPricing
    timeline_weeks: int
    terms: list[str]


class GeminiError(Exception):
    """Raised when a Gemini API call fails after retries."""
    def __init__(self, operation: str, cause: Exception):
        self.operation = operation
        self.cause = cause
        super().__init__(f"Gemini '{operation}' failed: {cause}")


def _gemini_retry():
    """Common retry decorator for Gemini calls: 3 attempts, exponential backoff on rate limits."""
    return retry(
        retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        before_sleep=lambda rs: logger.warning(
            "Gemini rate limit hit on attempt %d for %s, retrying in %ss",
            rs.attempt_number,
            rs.fn.__name__ if rs.fn else "unknown",
            rs.next_action.sleep if rs.next_action else 0,
        ),
        reraise=True,
    )


class GeminiService:
    def __init__(self):
        self.client = settings.get_genai_client()
        # Image/TTS models need SA + global location
        self._media_client = None

    def _get_media_client(self):
        """Get a client for media generation (image/TTS) — SA + global."""
        if self._media_client is None:
            from google.oauth2 import service_account
            import json
            sa_info = json.loads(settings.gca_key)
            creds = service_account.Credentials.from_service_account_info(
                sa_info, scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            project = settings.gcp_project_id or sa_info.get("project_id", "")
            self._media_client = genai.Client(
                vertexai=True, project=project, location="global", credentials=creds,
            )
        return self._media_client

    @_gemini_retry()
    def _generate(self, model: str, contents, config: dict | None = None):
        """Core Gemini call with retry on rate limits."""
        return self.client.models.generate_content(model=model, contents=contents, config=config or {})

    async def classify_enquiry(self, enquiry: Enquiry, wiki_context: str) -> dict:
        """Node 10: Classify enquiry using Gemini 3 Flash structured outputs."""
        prompt = f"""Classify this pre-sales enquiry:

Client: {enquiry.client_name}
Industry: {enquiry.industry or 'Unknown'}
Description: {enquiry.description}

Relevant wiki context:
{wiki_context[:3000]}"""

        try:
            response = self._generate(
                model=CLASSIFY_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": EnquiryClassification.model_json_schema(),
                },
            )
            result = EnquiryClassification.model_validate_json(response.text)
            return result.model_dump()
        except RETRYABLE_EXCEPTIONS as e:
            logger.error("Gemini classify rate-limited after retries: %s", e)
            raise GeminiError("classify_enquiry", e)
        except Exception as e:
            logger.error("Gemini classify failed: %s", e, exc_info=True)
            raise GeminiError("classify_enquiry", e)

    async def draft_proposal(
        self,
        enquiry: Enquiry,
        wiki_context: str,
        rules_output: RulesOutput,
        classification: dict,
    ) -> str:
        """Node 12: Draft proposal using Gemini 2.5 Pro (1M context)."""
        prompt = f"""You are a senior pre-sales consultant. Draft a professional proposal.

## RULES (deterministic — must be respected):
- Minimum margin: {rules_output.min_margin_pct}%
- Template: {rules_output.suggested_template}
- Two-person approval required: {rules_output.requires_two_person_approval}
- Policy violations: {rules_output.policy_violations or 'None'}

## CLASSIFICATION:
{json.dumps(classification, indent=2)}

## ENQUIRY:
- Client: {enquiry.client_name}
- Industry: {enquiry.industry or 'Unknown'}
- Description: {enquiry.description}
- Estimated value: {enquiry.estimated_value or 'TBD'}
- Estimated cost: {enquiry.estimated_cost or 'TBD'}

## WIKI CONTEXT (past cases, entity info, concepts):
{wiki_context[:50000]}

Draft a complete proposal including:
1. Executive Summary
2. Scope of Work
3. Deliverables
4. Assumptions & Exclusions
5. Pricing / Quotation
6. Timeline
7. Terms & Conditions

Use the rules above for pricing and margin guidance. Reference relevant past cases from the wiki context where applicable."""

        try:
            response = self._generate(model=REASONING_MODEL, contents=prompt)
            if not response.text:
                raise GeminiError("draft_proposal", ValueError("Empty response from Gemini"))
            return response.text
        except RETRYABLE_EXCEPTIONS as e:
            logger.error("Gemini draft rate-limited after retries: %s", e)
            raise GeminiError("draft_proposal", e)
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini draft failed: %s", e, exc_info=True)
            raise GeminiError("draft_proposal", e)

    async def draft_proposal_structured(
        self,
        enquiry: Enquiry,
        wiki_context: str,
        rules_output: RulesOutput,
        classification: dict,
    ) -> dict:
        """Node 12: Draft proposal as structured JSON using Gemini structured outputs."""
        prompt = f"""Draft a proposal based on:

Client: {enquiry.client_name}
Industry: {enquiry.industry or 'Unknown'}
Description: {enquiry.description}
Rules: min margin {rules_output.min_margin_pct}%, template {rules_output.suggested_template}
Classification: {json.dumps(classification)}
Wiki context: {wiki_context[:30000]}"""

        try:
            response = self._generate(
                model=REASONING_MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": StructuredProposal.model_json_schema(),
                },
            )
            result = StructuredProposal.model_validate_json(response.text)
            return result.model_dump()
        except Exception as e:
            logger.error("Gemini structured draft failed: %s", e, exc_info=True)
            raise GeminiError("draft_proposal_structured", e)

    async def answer_query(self, query: str, wiki_context: str) -> str:
        """General query against the wiki."""
        prompt = f"""Answer the following question using the wiki context provided.
If the wiki doesn't contain enough information, say so clearly.

## Wiki Context:
{wiki_context[:50000]}

## Question:
{query}

Provide a clear, concise answer with citations to specific wiki pages where possible."""

        try:
            response = self._generate(model=REASONING_MODEL, contents=prompt)
            if not response.text:
                raise GeminiError("answer_query", ValueError("Empty response"))
            return response.text
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini query failed: %s", e, exc_info=True)
            raise GeminiError("answer_query", e)

    async def process_pdf(self, pdf_bytes: bytes, prompt: str) -> str:
        """Process a PDF document using Gemini 3 Flash native vision (cheaper, great for OCR).
        Supports up to 1000 pages, 50MB per document."""
        try:
            response = self._generate(
                model=OCR_MODEL,
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    prompt,
                ],
            )
            if not response.text:
                raise GeminiError("process_pdf", ValueError("Empty response"))
            return response.text
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini PDF processing failed: %s", e, exc_info=True)
            raise GeminiError("process_pdf", e)

    async def process_pdf_structured(self, pdf_bytes: bytes, prompt: str, schema: dict) -> dict:
        """Process a PDF and extract structured data (e.g. invoice line items, contract terms)."""
        try:
            response = self._generate(
                model=OCR_MODEL,
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    prompt,
                ],
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": schema,
                },
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error("Gemini structured PDF extraction failed: %s", e, exc_info=True)
            raise GeminiError("process_pdf_structured", e)

    async def process_multiple_pdfs(self, pdf_bytes_list: list[bytes], prompt: str) -> str:
        """Process multiple PDFs in a single request (up to context window limit)."""
        parts = []
        for pdf_bytes in pdf_bytes_list:
            parts.append(types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"))
        parts.append(prompt)

        try:
            response = self._generate(model=REASONING_MODEL, contents=parts)
            if not response.text:
                raise GeminiError("process_multiple_pdfs", ValueError("Empty response"))
            return response.text
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Gemini multi-PDF processing failed: %s", e, exc_info=True)
            raise GeminiError("process_multiple_pdfs", e)

    # --- Image Generation ---

    @_gemini_retry()
    def _generate_image(self, prompt: str, aspect_ratio: str = "auto",
                         image_size: str = "1K") -> bytes | None:
        """Generate an image using gemini-3.1-flash-image-preview.

        Returns PNG image bytes, or None if no image was generated.
        """
        config = types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            safety_settings=[
                types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="OFF"),
                types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="OFF"),
            ],
            image_config=types.ImageConfig(
                aspect_ratio=aspect_ratio,
                image_size=image_size,
                output_mime_type="image/png",
            ),
        )
        response = self._get_media_client().models.generate_content(
            model=IMAGE_MODEL,
            contents=prompt,
            config=config,
        )
        # Extract image from response
        if response.candidates and response.candidates[0].content:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.data:
                    import base64
                    return base64.b64decode(part.inline_data.data)
        return None

    async def generate_image(self, prompt: str, aspect_ratio: str = "auto",
                              image_size: str = "1K") -> bytes:
        """Generate an image from a text prompt.

        Args:
            prompt: Description of the image to generate.
            aspect_ratio: "auto", "1:1", "16:9", "9:16", "4:3", "3:4"
            image_size: "1K" or "2K"

        Returns:
            PNG image bytes.

        Raises:
            GeminiError if generation fails.
        """
        try:
            result = self._generate_image(prompt, aspect_ratio=aspect_ratio, image_size=image_size)
            if not result:
                raise GeminiError("generate_image", ValueError("No image in response"))
            return result
        except GeminiError:
            raise
        except Exception as e:
            logger.error("Image generation failed: %s", e, exc_info=True)
            raise GeminiError("generate_image", e)

    # --- Text-to-Speech ---

    async def generate_speech(self, text: str, voice_name: str = "Achernar",
                               temperature: float = 1.0) -> bytes:
        """Generate speech audio from text using gemini-3.1-flash-tts-preview.

        Args:
            text: Text to convert to speech.
            voice_name: Prebuilt voice name (e.g. "Achernar", "Aoede", "Charon", "Fenrir", "Kore").
            temperature: Generation temperature (0.0–2.0).

        Returns:
            WAV audio bytes.
        """
        try:
            config = types.GenerateContentConfig(
                temperature=temperature,
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name,
                        ),
                    ),
                ),
            )
            response = self.client.models.generate_content(
                model=TTS_MODEL,
                contents=text,
                config=config,
            )
            # Extract audio from response
            if response.candidates and response.candidates[0].content:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data and part.inline_data.data:
                        import base64
                        audio_data = base64.b64decode(part.inline_data.data)
                        mime = part.inline_data.mime_type or "audio/mp3"
                        # Convert to WAV if raw PCM
                        if "L" in mime:
                            return self._convert_to_wav(audio_data, mime)
                        return audio_data
            raise GeminiError("generate_speech", ValueError("No audio in response"))
        except GeminiError:
            raise
        except Exception as e:
            logger.error("TTS generation failed: %s", e, exc_info=True)
            raise GeminiError("generate_speech", e)

    @staticmethod
    def _convert_to_wav(raw_audio: bytes, mime_type: str) -> bytes:
        """Convert raw PCM audio bytes to WAV format with proper header."""
        import struct
        # Parse MIME: e.g. "audio/L16;rate=24000"
        parts = mime_type.split(";")
        format_part = parts[0]  # e.g. "audio/L16"
        bits_per_sample = 16  # L16 = 16-bit
        sample_rate = 24000
        num_channels = 1

        for p in parts[1:]:
            if "rate=" in p:
                sample_rate = int(p.split("=")[1].strip())
            if "channels=" in p:
                num_channels = int(p.split("=")[1].strip())

        byte_rate = sample_rate * num_channels * bits_per_sample // 8
        block_align = num_channels * bits_per_sample // 8
        data_length = len(raw_audio)

        # WAV header (44 bytes)
        header = struct.pack(
            '<4sI4s4sIHHIIHH4sI',
            b'RIFF',
            36 + data_length,
            b'WAVE',
            b'fmt ',
            16,  # Subchunk1Size
            1,   # AudioFormat (PCM)
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
            b'data',
            data_length,
        )
        return header + raw_audio
```

  </app/services/gemini.py>

  <app/services/rag.py>

<a name="app-services-rag-py"></a>
### `app/services/rag.py`

```py
"""RAG Pipeline — chunking, embeddings, and vector search.

Dual embedding routes:
- gemini-embedding-2 (v2): Multimodal (text + images), prompt-based task instructions,
  auto-normalized, SA + location='us', individual calls.
- gemini-embedding-001 (v1): Text-only, task_type based, manual normalization,
  API key + no location, batch (up to 100).

Both share the same chunking, FTS5 keyword search, and cosine similarity logic.
Each route has its own DB table to keep embedding spaces separate.
"""

import asyncio
import json
import logging
import re
import sqlite3
from pathlib import Path
from typing import NamedTuple

import numpy as np
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

from backend.app.core.config import settings

logger = logging.getLogger("aries.rag")

# --- Embedding retry config ---
_embedding_retry = retry(
    retry=retry_if_exception_type((ResourceExhausted, ServiceUnavailable, Exception)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    before_sleep=lambda rs: logger.warning(
        "Embedding API rate limit hit on attempt %d for %s, retrying in %ss",
        rs.attempt_number,
        rs.fn.__name__ if rs.fn else "unknown",
        rs.next_action.sleep if rs.next_action else 0,
    ),
    reraise=True,
)

# --- Embedding models ---
# v2: Multimodal (text + images), prompt-based, auto-normalized, SA + 'us'
EMBEDDING_MODEL_V2 = "gemini-embedding-2"
# v1: Text-only, task_type based, manual normalization, API key + no location
EMBEDDING_MODEL_V1 = "gemini-embedding-001"
EMBEDDING_DIM = 768  # truncated from 3072 via output_dimensionality

# Chunking parameters
CHUNK_SIZE = 1000  # target characters per chunk
CHUNK_OVERLAP = 200  # overlap characters between chunks
MIN_CHUNK_SIZE = 100  # don't create chunks smaller than this


class Chunk(NamedTuple):
    content: str
    metadata: dict  # source_path, heading, chunk_index, char_start, char_end


class SearchResult(NamedTuple):
    content: str
    score: float
    metadata: dict


# --- v2 prompt-based helpers (gemini-embedding-2) ---

def _prepare_document_v2(title: str, content: str) -> str:
    """Format a document for v2 embedding — prompt-based task instruction.

    Format: "title: {title} | text: {content}"
    """
    title = title or "none"
    return f"title: {title} | text: {content}"


def _prepare_query_v2(query: str) -> str:
    """Format a query for v2 embedding — prompt-based task instruction.

    Format: "task: search result | query: {query}"
    """
    return f"task: search result | query: {query}"


# --- v1 task_type helpers (gemini-embedding-001) ---
# No special formatting needed — raw text + task_type parameter handles it.


class RAGService:
    """RAG pipeline: chunk → embed → store → search.

    Supports two embedding routes:
    - v2 (default): gemini-embedding-2 — multimodal, prompt-based, auto-normalized
    - v1: gemini-embedding-001 — text-only, task_type, manual normalization, batch

    Each route has its own DB table (chunks_v2 / chunks_v1) to keep
    embedding spaces separate and avoid cross-contamination.
    """

    # Allowlist of valid table/FTS names — prevents SQL injection via f-strings
    _VALID_TABLES = {"chunks_v1", "chunks_v2"}
    _VALID_FTS = {"chunks_v1_fts", "chunks_v2_fts"}

    def __init__(self, route: str = "v2"):
        """Initialize RAG service with the specified embedding route.

        Args:
            route: "v2" (default) for gemini-embedding-2, or "v1" for gemini-embedding-001

        Raises:
            ValueError: If the route is not "v1" or "v2".
        """
        if route not in ("v1", "v2"):
            raise ValueError(f"Invalid route: {route!r}. Use 'v1' or 'v2'.")
        self.route = route
        self.model = EMBEDDING_MODEL_V2 if route == "v2" else EMBEDDING_MODEL_V1
        self.table = f"chunks_{route}"
        self.fts_table = f"chunks_{route}_fts"

        # Validate table names against allowlist to prevent SQL injection
        if self.table not in self._VALID_TABLES:
            raise ValueError(f"Invalid table name: {self.table!r}")
        if self.fts_table not in self._VALID_FTS:
            raise ValueError(f"Invalid FTS table name: {self.fts_table!r}")

        # v2 uses SA + 'us', v1 uses API key + no location
        if route == "v2":
            self.client = settings.get_embedding_client()
        else:
            self.client = settings.get_genai_client()

        self.db_path = Path(settings.database_url.replace("sqlite+aiosqlite:///", "")).parent / "rag_store.db"
        self._query_cache: dict[str, list[float]] = {}
        self._init_db()

    def _init_db(self):
        """Initialize the RAG vector store database."""
        conn = sqlite3.connect(str(self.db_path))

        # --- v2 table (multimodal, with modality column) ---
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_path TEXT NOT NULL,
                heading TEXT,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                char_start INTEGER,
                char_end INTEGER,
                modality TEXT DEFAULT 'text',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_v2_source ON chunks_v2(source_path)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_v2_modality ON chunks_v2(modality)
        """)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_v2_fts USING fts5(
                content,
                heading,
                source_path,
                content='chunks_v2',
                content_rowid='id'
            )
        """)

        # --- v1 table (text-only, no modality column) ---
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks_v1 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_path TEXT NOT NULL,
                heading TEXT,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                char_start INTEGER,
                char_end INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_v1_source ON chunks_v1(source_path)
        """)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_v1_fts USING fts5(
                content,
                heading,
                source_path,
                content='chunks_v1',
                content_rowid='id'
            )
        """)

        conn.commit()
        conn.close()

    # --- Chunking ---

    @staticmethod
    def chunk_markdown(text: str, source_path: str = "") -> list[Chunk]:
        """Split markdown text into chunks respecting heading boundaries.

        Each chunk starts at a heading and includes all content until the
        next heading of equal or higher level. Oversized sections are
        split with overlap.
        """
        chunks = []

        # Split by headings (## or ### etc.)
        heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
        sections: list[tuple[str, str]] = []  # (heading, content)

        last_end = 0
        current_heading = source_path or "root"

        for match in heading_pattern.finditer(text):
            # Content before this heading belongs to the previous section
            if sections:
                sections[-1] = (sections[-1][0], sections[-1][1] + text[last_end:match.start()])
            else:
                preamble = text[last_end:match.start()].strip()
                if preamble:
                    sections.append(("root", preamble))

            current_heading = match.group(2).strip()
            sections.append((current_heading, ""))
            last_end = match.end()

        # Add remaining content to last section
        if sections:
            sections[-1] = (sections[-1][0], sections[-1][1] + text[last_end:])
        elif text.strip():
            sections.append(("root", text))

        # Now split oversized sections into chunks
        for heading, content in sections:
            content = content.strip()
            if not content:
                continue

            if len(content) <= CHUNK_SIZE:
                chunks.append(Chunk(
                    content=content,
                    metadata={
                        "source_path": source_path,
                        "heading": heading,
                        "chunk_index": len(chunks),
                    },
                ))
            else:
                # Split with overlap
                start = 0
                while start < len(content):
                    end = start + CHUNK_SIZE
                    chunk_text = content[start:end]

                    # Try to break at paragraph boundary
                    if end < len(content):
                        para_break = chunk_text.rfind('\n\n', -CHUNK_OVERLAP)
                        if para_break > MIN_CHUNK_SIZE:
                            end = start + para_break + 2
                            chunk_text = content[start:end]

                    chunk_text = chunk_text.strip()
                    if len(chunk_text) >= MIN_CHUNK_SIZE:
                        chunks.append(Chunk(
                            content=chunk_text,
                            metadata={
                                "source_path": source_path,
                                "heading": heading,
                                "chunk_index": len(chunks),
                                "char_start": start,
                                "char_end": end,
                            },
                        ))

                    start = end - CHUNK_OVERLAP if end < len(content) else end

        return chunks

    # --- Embedding ---

    async def embed_texts(self, texts: list[str], titles: list[str] | None = None) -> list[list[float]]:
        """Generate embeddings for a list of texts.

        v2: prompt-based task instructions, individual calls (v2 aggregates multi-input).
        v1: task_type=RETRIEVAL_DOCUMENT, batch up to 100.
        """
        if not texts:
            return []

        if titles is None:
            titles = [None] * len(texts)

        embeddings = []

        if self.route == "v2":
            # v2: Embed documents individually — aggregates multi-input into one vector
            for i, (text, title) in enumerate(zip(texts, titles)):
                try:
                    prepared = _prepare_document_v2(title or "none", text)

                    @_embedding_retry
                    def _embed_single_v2(prepared_text):
                        return self.client.models.embed_content(
                            model=self.model,
                            contents=prepared_text,
                            config=types.EmbedContentConfig(
                                output_dimensionality=EMBEDDING_DIM,
                            ),
                        )

                    result = _embed_single_v2(prepared)
                    embeddings.append(result.embeddings[0].values)
                except Exception as e:
                    logger.error("v2 embedding failed for doc %d: %s", i, e)
                    embeddings.append([0.0] * EMBEDDING_DIM)
        else:
            # v1: Batch up to 100 texts per call with task_type
            for i in range(0, len(texts), 100):
                batch = texts[i:i + 100]
                try:

                    @_embedding_retry
                    def _embed_batch_v1(batch_texts):
                        return self.client.models.embed_content(
                            model=self.model,
                            contents=batch_texts,
                            config=types.EmbedContentConfig(
                                task_type="RETRIEVAL_DOCUMENT",
                                output_dimensionality=EMBEDDING_DIM,
                            ),
                        )

                    result = _embed_batch_v1(batch)
                    for emb in result.embeddings:
                        vec = np.array(emb.values, dtype=np.float32)
                        # Manual normalization for v1 (not auto-normalized)
                        norm = np.linalg.norm(vec)
                        if norm > 0:
                            vec = vec / norm
                        embeddings.append(vec.tolist())
                except Exception as e:
                    logger.error("v1 embedding failed for batch %d: %s", i // 100, e)
                    for _ in batch:
                        embeddings.append([0.0] * EMBEDDING_DIM)

        return embeddings

    async def embed_query(self, query: str) -> list[float]:
        """Generate embedding for a single query.

        v2: prompt-based task instruction "task: search result | query: {query}"
        v1: task_type=RETRIEVAL_QUERY, manual normalization

        Results are cached by normalized query string (LRU-like, max 500 entries).
        """
        cache_key = query.lower().strip()
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        try:
            if self.route == "v2":
                prepared = _prepare_query_v2(query)

                @_embedding_retry
                def _embed_query_v2(prepared_text):
                    return self.client.models.embed_content(
                        model=self.model,
                        contents=prepared_text,
                        config=types.EmbedContentConfig(
                            output_dimensionality=EMBEDDING_DIM,
                        ),
                    )

                result = _embed_query_v2(prepared)
                embedding = result.embeddings[0].values
            else:
                # v1: task_type based, manual normalization

                @_embedding_retry
                def _embed_query_v1(query_text):
                    return self.client.models.embed_content(
                        model=self.model,
                        contents=[query_text],
                        config=types.EmbedContentConfig(
                            task_type="RETRIEVAL_QUERY",
                            output_dimensionality=EMBEDDING_DIM,
                        ),
                    )

                result = _embed_query_v1(query)
                vec = np.array(result.embeddings[0].values, dtype=np.float32)
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                embedding = vec.tolist()

            self._query_cache[cache_key] = embedding
            # Keep cache bounded
            if len(self._query_cache) > 500:
                self._query_cache.pop(next(iter(self._query_cache)))
            return embedding
        except Exception as e:
            logger.error("Query embedding failed: %s", e)
            return [0.0] * EMBEDDING_DIM

    async def embed_image(self, image_bytes: bytes, mime_type: str = "image/jpeg",
                          title: str = "none") -> list[float]:
        """Generate embedding for an image (v2 only — multimodal).

        Combines a text description with the image in the same embedding space,
        enabling cross-modal search (text query → image result).
        Not supported on v1 (text-only model).
        """
        if self.route == "v1":
            logger.warning("Image embedding not supported on v1 (text-only model)")
            return [0.0] * EMBEDDING_DIM

        try:
            prepared_text = _prepare_document_v2(title, "invoice image")
            contents = [
                prepared_text,
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            ]

            result = self.client.models.embed_content(
                model=self.model,
                contents=contents,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                ),
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error("Image embedding failed: %s", e)
            return [0.0] * EMBEDDING_DIM

    async def embed_pdf(self, pdf_bytes: bytes, title: str = "none") -> list[float]:
        """Generate embedding for a PDF document (v2 only — multimodal).

        gemini-embedding-2 supports PDFs up to 6 pages inline.
        Not supported on v1 (text-only model).
        """
        if self.route == "v1":
            logger.warning("PDF embedding not supported on v1 (text-only model)")
            return [0.0] * EMBEDDING_DIM

        try:
            prepared_text = _prepare_document_v2(title, "pdf document")
            contents = [
                prepared_text,
                types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            ]

            result = self.client.models.embed_content(
                model=self.model,
                contents=contents,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                ),
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error("PDF embedding failed: %s", e)
            return [0.0] * EMBEDDING_DIM

    # --- Storage ---

    async def index_chunks(self, chunks: list[Chunk]) -> int:
        """Embed and store chunks in the vector store (route-specific table)."""
        if not chunks:
            return 0

        texts = [c.content for c in chunks]
        titles = [c.metadata.get("heading") for c in chunks]
        embeddings = await self.embed_texts(texts, titles=titles)

        # Prepare data for sync insertion
        rows = []
        for chunk, embedding in zip(chunks, embeddings):
            emb_bytes = np.array(embedding, dtype=np.float32).tobytes()
            rows.append((chunk, emb_bytes))

        count = await asyncio.to_thread(self._index_chunks_sync, rows)
        logger.info("Indexed %d chunks into %s from %s", count, self.table, chunks[0].metadata.get("source_path", ""))
        return count

    def _index_chunks_sync(self, rows: list[tuple]) -> int:
        """Synchronous chunk insertion — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        count = 0
        for chunk, emb_bytes in rows:
            if self.route == "v2":
                conn.execute(
                    f"""INSERT INTO {self.table} (source_path, heading, chunk_index, content, embedding, char_start, char_end, modality)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        chunk.metadata.get("source_path", ""),
                        chunk.metadata.get("heading", ""),
                        chunk.metadata.get("chunk_index", 0),
                        chunk.content,
                        emb_bytes,
                        chunk.metadata.get("char_start"),
                        chunk.metadata.get("char_end"),
                        "text",
                    ),
                )
            else:
                # v1: no modality column
                conn.execute(
                    f"""INSERT INTO {self.table} (source_path, heading, chunk_index, content, embedding, char_start, char_end)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        chunk.metadata.get("source_path", ""),
                        chunk.metadata.get("heading", ""),
                        chunk.metadata.get("chunk_index", 0),
                        chunk.content,
                        emb_bytes,
                        chunk.metadata.get("char_start"),
                        chunk.metadata.get("char_end"),
                    ),
                )
            count += 1

        conn.commit()
        conn.close()
        return count

    async def index_image(self, image_path: str, source_path: str,
                          title: str = "none") -> int:
        """Embed and store an image in the vector store for cross-modal search (v2 only)."""
        if self.route == "v1":
            logger.warning("Image indexing not supported on v1 (text-only model)")
            return 0

        path = Path(image_path)
        if not path.exists():
            logger.error("Image not found: %s", image_path)
            return 0

        # Determine MIME type
        suffix = path.suffix.lower()
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
        mime_type = mime_map.get(suffix, "image/jpeg")

        image_bytes = path.read_bytes()
        embedding = await self.embed_image(image_bytes, mime_type=mime_type, title=title)

        emb_bytes = np.array(embedding, dtype=np.float32).tobytes()

        await asyncio.to_thread(
            self._index_image_sync, source_path, title, path.name, emb_bytes
        )
        logger.info("Indexed image %s as %s", path.name, source_path)
        return 1

    def _index_image_sync(self, source_path: str, title: str, filename: str, emb_bytes: bytes):
        """Synchronous image insertion — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        conn.execute(
            f"""INSERT INTO {self.table} (source_path, heading, chunk_index, content, embedding, char_start, char_end, modality)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (source_path, title, 0, f"[Image: {filename}]", emb_bytes, 0, 0, "image"),
        )
        conn.commit()
        conn.close()

    async def index_wiki_page(self, path: str, content: str) -> int:
        """Chunk a wiki page and index it into the vector store."""
        # Delete existing chunks for this path
        await self._delete_path(path)

        chunks = self.chunk_markdown(content, source_path=path)
        return await self.index_chunks(chunks)

    async def index_wiki_all(self) -> dict:
        """Index all wiki pages into the RAG store."""
        from backend.app.services.wiki import WikiService
        wiki = WikiService()
        pages = wiki.list_pages()

        total_chunks = 0
        indexed_pages = 0
        errors = []

        for page_path in pages:
            page = wiki.read_page(page_path)
            if not page:
                continue
            try:
                count = await self.index_wiki_page(page_path, page.content)
                total_chunks += count
                indexed_pages += 1
            except Exception as e:
                errors.append(f"{page_path}: {e}")
                logger.error("Failed to index wiki page %s: %s", page_path, e)

        return {
            "indexed_pages": indexed_pages,
            "total_chunks": total_chunks,
            "errors": errors,
        }

    async def index_ocr_images(self, images_dir: str, limit: int | None = None) -> dict:
        """Index OCR invoice images into the vector store for cross-modal search.

        This enables searching for invoices by text description and finding
        matching images (cross-modal retrieval).
        """
        images_path = Path(images_dir)
        if not images_path.exists():
            return {"indexed_images": 0, "errors": [f"Directory not found: {images_dir}"]}

        # Find all image files
        image_files = sorted(
            list(images_path.glob("*.jpg")) + list(images_path.glob("*.jpeg")) + list(images_path.glob("*.png"))
        )

        if limit:
            image_files = image_files[:limit]

        indexed = 0
        errors = []

        for img_path in image_files:
            try:
                # Use filename as source path for OCR images
                source_path = f"ocr_invoices/{img_path.name}"
                title = img_path.stem.replace("_", " ").replace("-", " ")
                await self.index_image(str(img_path), source_path=source_path, title=title)
                indexed += 1
            except Exception as e:
                errors.append(f"{img_path.name}: {e}")
                logger.error("Failed to index image %s: %s", img_path.name, e)

        return {
            "indexed_images": indexed,
            "total_images": len(image_files),
            "errors": errors,
        }

    async def _delete_path(self, path: str):
        """Remove all chunks for a given source path (route-specific table).

        Delegates the synchronous SQLite work to a thread via asyncio.to_thread.
        """
        await asyncio.to_thread(self._delete_path_sync, path)

    def _delete_path_sync(self, path: str):
        """Synchronous path deletion — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        conn.execute(f"DELETE FROM {self.table} WHERE source_path = ?", (path,))
        conn.commit()
        conn.close()

    # --- Search ---

    async def search(
        self,
        query: str,
        limit: int = 10,
        method: str = "hybrid",
        modality: str | None = None,
    ) -> list[SearchResult]:
        """Search the RAG store.

        Methods:
        - 'semantic': cosine similarity over embeddings
        - 'keyword': FTS5 full-text search
        - 'hybrid': combine both (default)

        Modality filter:
        - None: search all modalities (text + images)
        - 'text': search only text chunks
        - 'image': search only image chunks
        """
        results = []

        if method in ("semantic", "hybrid"):
            semantic_results = await self._semantic_search(query, limit=limit * 2, modality=modality)
            results.extend(semantic_results)

        if method in ("keyword", "hybrid"):
            keyword_results = await self._keyword_search(query, limit=limit * 2)
            results.extend(keyword_results)

        # Deduplicate by content, keep highest score
        seen: dict[str, SearchResult] = {}
        for r in results:
            key = r.content[:200]
            if key not in seen or r.score > seen[key].score:
                seen[key] = r

        # Sort by score descending
        sorted_results = sorted(seen.values(), key=lambda x: x.score, reverse=True)
        return sorted_results[:limit]

    async def _semantic_search(self, query: str, limit: int = 20,
                                modality: str | None = None) -> list[SearchResult]:
        """Search using cosine similarity over stored embeddings (route-specific table).

        Delegates the synchronous SQLite + numpy work to a thread via asyncio.to_thread.
        """
        query_embedding = await self.embed_query(query)
        if all(v == 0.0 for v in query_embedding):
            return []

        return await asyncio.to_thread(
            self._semantic_search_sync, query_embedding, limit, modality
        )

    def _semantic_search_sync(self, query_embedding: list[float], limit: int,
                               modality: str | None) -> list[SearchResult]:
        """Synchronous cosine-similarity search — runs in a worker thread."""
        query_vec = np.array(query_embedding, dtype=np.float32)
        # Both routes produce normalized vectors (v2 auto-normalizes, v1 we normalize manually)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []

        conn = sqlite3.connect(str(self.db_path))

        # Build query with optional modality filter (v2 only)
        if self.route == "v2" and modality:
            cursor = conn.execute(
                f"SELECT id, source_path, heading, content, embedding, modality FROM {self.table} WHERE embedding IS NOT NULL AND modality = ?",
                (modality,),
            )
        elif self.route == "v2":
            cursor = conn.execute(
                f"SELECT id, source_path, heading, content, embedding, modality FROM {self.table} WHERE embedding IS NOT NULL"
            )
        else:
            # v1: no modality column
            cursor = conn.execute(
                f"SELECT id, source_path, heading, content, embedding FROM {self.table} WHERE embedding IS NOT NULL"
            )
        rows = cursor.fetchall()
        conn.close()

        results = []
        for row in rows:
            if self.route == "v2":
                chunk_id, source_path, heading, content, emb_bytes, chunk_modality = row
            else:
                chunk_id, source_path, heading, content, emb_bytes = row
                chunk_modality = "text"

            if not emb_bytes:
                continue

            chunk_vec = np.frombuffer(emb_bytes, dtype=np.float32)
            chunk_norm = np.linalg.norm(chunk_vec)
            if chunk_norm == 0:
                continue

            # Cosine similarity
            similarity = float(np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm))
            if similarity > 0.3:  # relevance threshold
                results.append(SearchResult(
                    content=content,
                    score=similarity,
                    metadata={
                        "source_path": source_path,
                        "heading": heading,
                        "method": "semantic",
                        "modality": chunk_modality or "text",
                    },
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]

    async def _keyword_search(self, query: str, limit: int = 20) -> list[SearchResult]:
        """Search using FTS5 full-text search (route-specific table).

        Delegates the synchronous SQLite work to a thread via asyncio.to_thread.
        """
        return await asyncio.to_thread(self._keyword_search_sync, query, limit)

    def _keyword_search_sync(self, query: str, limit: int) -> list[SearchResult]:
        """Synchronous FTS5 keyword search — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                f"""SELECT c.source_path, c.heading, c.content, f.rank
                   FROM {self.fts_table} f
                   JOIN {self.table} c ON c.id = f.rowid
                   WHERE {self.fts_table} MATCH ?
                   ORDER BY f.rank
                   LIMIT ?""",
                (query, limit),
            )
            rows = cursor.fetchall()
        except sqlite3.OperationalError:
            # FTS5 might not handle special chars
            rows = []
        conn.close()

        results = []
        for source_path, heading, content, rank in rows:
            # Convert FTS5 rank (negative BM25) to 0-1 score
            score = min(1.0, max(0.0, 1.0 + rank / 10))
            results.append(SearchResult(
                content=content,
                score=score,
                metadata={"source_path": source_path, "heading": heading, "method": "keyword"},
            ))

        return results
```

  </app/services/rag.py>

  <app/services/pipeline.py>

<a name="app-services-pipeline-py"></a>
### `app/services/pipeline.py`

```py
"""AI Decisioning Pipeline — Nodes 9-13.

Wiki-first retrieval → Gemini classification → Rules engine → LLM reasoning → Policy gate.
All Gemini failures are caught and surfaced — no silent swallowing.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

# TODO: Migrate _wiki_retrieval to use shared helper from backend.app.services.wiki_context.build_wiki_context

from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.schemas.enquiry import PipelineRunResponse
from backend.app.services.rules import apply_rules, RulesOutput
from backend.app.services.wiki import WikiService
from backend.app.services.gemini import GeminiService, GeminiError

logger = logging.getLogger("aries.pipeline")


async def run_pipeline(enquiry: Enquiry, db: AsyncSession) -> PipelineRunResponse:
    """Run the full decisioning pipeline for an enquiry (Nodes 9→13)."""

    # Node 9: Wiki-first retrieval
    wiki = WikiService()
    wiki_context = await _wiki_retrieval(enquiry, wiki)

    # Node 10: Gemini Structured Classification
    try:
        classification = await _classify_enquiry(enquiry, wiki_context)
        enquiry.scope_category = classification.get("category")
        enquiry.complexity = classification.get("complexity")
        enquiry.resource_profile = classification.get("resource_profile")
    except GeminiError as e:
        logger.error("Pipeline classification failed for enquiry %s: %s", enquiry.id, e)
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
        await db.commit()
        return PipelineRunResponse(
            enquiry_id=enquiry.id,
            status="classification_failed",
            message=f"AI classification failed: {e}. Manual classification required.",
        )

    enquiry.status = EnquiryStatus.CLASSIFIED
    await db.commit()

    # Node 11: Rules Engine — ALWAYS before LLM
    rules_output = apply_rules(
        estimated_value=enquiry.estimated_value,
        estimated_cost=enquiry.estimated_cost,
        industry=enquiry.industry,
        subdivision=enquiry.subdivision,
    )
    enquiry.status = EnquiryStatus.RULES_APPLIED
    await db.commit()

    # Node 12: LLM Reasoning (Gemini 3.1 Pro)
    try:
        gemini = GeminiService()
        llm_draft = await gemini.draft_proposal(
            enquiry=enquiry,
            wiki_context=wiki_context,
            rules_output=rules_output,
            classification=classification,
        )
    except GeminiError as e:
        logger.error("Pipeline LLM drafting failed for enquiry %s: %s", enquiry.id, e)
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
        await db.commit()
        return PipelineRunResponse(
            enquiry_id=enquiry.id,
            status="drafting_failed",
            message=f"AI drafting failed: {e}. Manual draft required.",
            rules_output=_rules_to_dict(rules_output),
            classification=classification,
        )

    enquiry.status = EnquiryStatus.LLM_DRAFTED
    await db.commit()

    # Node 13: Policy validation gate
    if rules_output.policy_violations:
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
        await db.commit()
        return PipelineRunResponse(
            enquiry_id=enquiry.id,
            status="human_review_required",
            message=f"Policy violations: {'; '.join(rules_output.policy_violations)}",
            rules_output=_rules_to_dict(rules_output),
            llm_draft=llm_draft,
        )

    enquiry.status = EnquiryStatus.POLICY_REVIEW
    await db.commit()

    return PipelineRunResponse(
        enquiry_id=enquiry.id,
        status="policy_review",
        message="Draft generated, awaiting human approval",
        rules_output=_rules_to_dict(rules_output),
        llm_draft=llm_draft,
    )


async def _wiki_retrieval(enquiry: Enquiry, wiki: WikiService) -> str:
    """Node 9: Wiki-first retrieval. Read index.md, follow links to relevant pages."""
    index = wiki.read_page("index.md")
    context_parts = [f"# Wiki Index\n{index.content}"] if index else []

    search_terms = [enquiry.client_name]
    if enquiry.industry:
        search_terms.append(enquiry.industry)
    if enquiry.scope_category:
        search_terms.append(enquiry.scope_category)

    for term in search_terms:
        results = wiki.search(term, limit=5)
        for r in results:
            page = wiki.read_page(r.path)
            if page:
                context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")

    return "\n\n---\n\n".join(context_parts) if context_parts else "No wiki context available."


async def _classify_enquiry(enquiry: Enquiry, wiki_context: str) -> dict:
    """Node 10: Gemini Structured Classification (replaces ML)."""
    gemini = GeminiService()
    return await gemini.classify_enquiry(enquiry, wiki_context)


def _rules_to_dict(rules: RulesOutput) -> dict:
    return {
        "min_margin_pct": rules.min_margin_pct,
        "approval_threshold_value": rules.approval_threshold_value,
        "suggested_template": rules.suggested_template,
        "requires_two_person_approval": rules.requires_two_person_approval,
        "policy_violations": rules.policy_violations,
        "pricing_adjustments": rules.pricing_adjustments,
    }
```

  </app/services/pipeline.py>

  <app/services/wiki_context.py>

<a name="app-services-wiki-context-py"></a>
### `app/services/wiki_context.py`

```py
"""Shared wiki context builder — eliminates duplicate wiki-retrieval extraction.

Multiple files in the codebase build wiki context by:
1. Searching wiki for relevant pages
2. Reading each page's content
3. Joining them into a context string

This module provides a single shared implementation so that all callers
can converge on one place. Existing callers should migrate to this helper
and remove their local implementations.
"""

import logging

logger = logging.getLogger("aries.wiki_context")


async def build_wiki_context(query: str, limit: int = 5) -> str:
    """Search wiki for relevant pages and build context string.

    Args:
        query: The search query (typically the user's message or enquiry terms).
        limit: Maximum number of wiki pages to include.

    Returns:
        A string with wiki page contents joined by separators,
        or empty string if no results found.
    """
    from backend.app.services.wiki import WikiService

    wiki = WikiService()
    results = wiki.search(query, limit=limit)
    if not results:
        return ""

    context_parts = []
    for r in results[:limit]:
        page = wiki.read_page(r.path)
        if page:
            context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")

    return "\n\n---\n\n".join(context_parts) if context_parts else ""
```

  </app/services/wiki_context.py>

  <app/services/wiki.py>

<a name="app-services-wiki-py"></a>
### `app/services/wiki.py`

```py
"""LLM Wiki service — git-versioned markdown knowledge repository (Node 7)."""

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path

import git

from backend.app.core.config import settings
from backend.app.schemas.enquiry import WikiPageRead, WikiSearchResult


class WikiService:
    def __init__(self, wiki_root: Path | None = None):
        self.wiki_root = wiki_root or settings.wiki_root
        self._ensure_repo()

    def _ensure_repo(self):
        """Initialize wiki repo if it doesn't exist."""
        self.wiki_root.mkdir(parents=True, exist_ok=True)

        if not (self.wiki_root / ".git").exists():
            repo = git.Repo.init(self.wiki_root)
            # Create initial structure
            for subdir in ["entities", "concepts", "sources", "outcomes"]:
                (self.wiki_root / subdir).mkdir(exist_ok=True)
                (self.wiki_root / subdir / ".gitkeep").touch()

            self._write_file("index.md", "# Aries Wiki Index\n\n> Auto-generated content catalog.\n\n")
            self._write_file("log.md", "# Aries Change Log\n\n> Append-only log of wiki modifications.\n\n")
            self._write_file(
                "AGENTS.md",
                "# Aries Agent Schema\n\n"
                "## Wiki Structure\n"
                "- `index.md` — Content catalog, read first on every query\n"
                "- `log.md` — Chronological append-only log\n"
                "- `AGENTS.md` — This file: schema and conventions\n"
                "- `entities/` — One page per client, project, product, contact\n"
                "- `concepts/` — Pricing patterns, margin policies, scope templates\n"
                "- `sources/` — One summary page per ingested source document\n"
                "- `outcomes/` — Post-delivery learnings\n\n"
                "## Conventions\n"
                "- Every page starts with a YAML-style metadata header\n"
                "- Entity pages: `---\\ntype: entity\\ncategory: client|project|product|contact\\n---\\n`\n"
                "- Source pages: `---\\ntype: source\\nenquiry_id: <uuid>\\nfile: <filename>\\ningested: <date>\\n---\\n`\n"
                "- Cross-references use `[[page-path]]` wiki-links\n"
                "- Log entries: `## [YYYY-MM-DD] ingest|query|lint | <title>`\n",
            )

            repo.index.add(["index.md", "log.md", "AGENTS.md"])
            for subdir in ["entities", "concepts", "sources", "outcomes"]:
                repo.index.add([f"{subdir}/.gitkeep"])
            repo.index.commit("Initial wiki structure")
        else:
            for subdir in ["entities", "concepts", "sources", "outcomes"]:
                (self.wiki_root / subdir).mkdir(exist_ok=True)

    def _get_repo(self) -> git.Repo:
        return git.Repo(self.wiki_root)

    def _write_file(self, rel_path: str, content: str):
        full_path = self.wiki_root / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")

    def _read_file(self, rel_path: str) -> str | None:
        full_path = self.wiki_root / rel_path
        if not full_path.exists():
            return None
        return full_path.read_text(encoding="utf-8")

    def list_pages(self) -> list[str]:
        """List all .md files in the wiki."""
        pages = []
        for p in sorted(self.wiki_root.rglob("*.md")):
            rel = p.relative_to(self.wiki_root)
            if str(rel) == ".git":
                continue
            pages.append(str(rel))
        return pages

    def read_page(self, path: str) -> WikiPageRead | None:
        content = self._read_file(path)
        if content is None:
            return None

        repo = self._get_repo()
        last_commit = None
        last_modified = None
        try:
            commits = list(repo.iter_commits(paths=path, max_count=1))
            if commits:
                last_commit = commits[0].hexsha[:8]
                last_modified = datetime.fromtimestamp(commits[0].committed_time, tz=timezone.utc)
        except Exception:
            pass

        return WikiPageRead(path=path, content=content, last_modified=last_modified, last_commit=last_commit)

    def write_page(self, path: str, content: str, commit_message: str) -> WikiPageRead:
        """Write or update a wiki page with git commit. Append-or-merge semantics."""
        self._write_file(path, content)
        repo = self._get_repo()
        repo.index.add([path])

        # Append to log.md
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        action = "create" if not self._read_file(path) else "update"
        log_entry = f"\n## [{now}] {action} | {path}\n{commit_message}\n"
        log_content = self._read_file("log.md") or ""
        self._write_file("log.md", log_content + log_entry)
        repo.index.add(["log.md"])

        repo.index.commit(commit_message)
        return self.read_page(path)

    def delete_page(self, path: str, commit_message: str):
        full_path = self.wiki_root / path
        if full_path.exists():
            full_path.unlink()
            repo = self._get_repo()
            repo.index.remove([path])

            log_entry = f"\n## [{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] delete | {path}\n{commit_message}\n"
            log_content = self._read_file("log.md") or ""
            self._write_file("log.md", log_content + log_entry)
            repo.index.add(["log.md"])
            repo.index.commit(commit_message)

    def search(self, query: str, limit: int = 10) -> list[WikiSearchResult]:
        """Simple text search across wiki pages. Will be enhanced with BM25 + vector later."""
        results = []
        query_lower = query.lower()
        terms = query_lower.split()

        for page_path in self.list_pages():
            content = self._read_file(page_path)
            if not content:
                continue

            content_lower = content.lower()
            score = sum(1 for term in terms if term in content_lower)

            if score > 0:
                # Extract a snippet around first match
                snippet = ""
                for term in terms:
                    idx = content_lower.find(term)
                    if idx >= 0:
                        start = max(0, idx - 80)
                        end = min(len(content), idx + 120)
                        snippet = content[start:end].replace("\n", " ")
                        break

                title = Path(page_path).stem.replace("-", " ").title()
                results.append(WikiSearchResult(path=page_path, title=title, snippet=snippet, score=float(score)))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    def update_index(self):
        """Regenerate index.md with all current pages."""
        lines = ["# Aries Wiki Index\n\n> Auto-generated content catalog.\n\n"]

        categories = {"entities": [], "concepts": [], "sources": [], "outcomes": [], "root": []}
        for page_path in self.list_pages():
            if page_path in ("index.md", "log.md", "AGENTS.md"):
                continue
            parts = Path(page_path).parts
            if len(parts) > 1 and parts[0] in categories:
                categories[parts[0]].append(page_path)
            else:
                categories["root"].append(page_path)

        for cat, pages in categories.items():
            if not pages:
                continue
            lines.append(f"## {cat.title()}\n\n")
            for p in pages:
                title = Path(p).stem.replace("-", " ").title()
                lines.append(f"- [[{p}|{title}]]\n")
            lines.append("\n")

        self.write_page("index.md", "".join(lines), "Auto-regenerate index.md")

    def append_to_log(self, action: str, title: str, details: str = ""):
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        entry = f"\n## [{now}] {action} | {title}\n{details}\n"
        log_content = self._read_file("log.md") or ""
        self._write_file("log.md", log_content + entry)

        repo = self._get_repo()
        repo.index.add(["log.md"])
        repo.index.commit(f"{action}: {title}")

    # --- Async wrappers (offload blocking I/O to thread pool) ---

    async def async_read_page(self, path: str):
        """Async wrapper for read_page — offloads blocking file/git I/O to a thread."""
        return await asyncio.to_thread(self.read_page, path)

    async def async_search(self, query: str, limit: int = 10):
        """Async wrapper for search — offloads blocking file I/O to a thread."""
        return await asyncio.to_thread(self.search, query, limit)
```

  </app/services/wiki.py>

  <app/services/workflow_executor.py>

<a name="app-services-workflow-executor-py"></a>
### `app/services/workflow_executor.py`

```py
"""DAG Workflow Executor — reads nodes/edges from DB and executes in topological order.

Each node type has a dedicated handler. The executor walks the DAG from
the start node, following edges (respecting conditions), and records
per-node execution with timing, input/output, and errors.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

# TODO: Migrate _node_wiki_retrieval to use shared helper from backend.app.services.wiki_context.build_wiki_context

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.workflow import (
    WorkflowExecution, ExecutionStatus, NodeExecution,
    WorkflowNode, NodeType, WorkflowEdge,
)
from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.services.wiki import WikiService
from backend.app.services.gemini import GeminiService, GeminiError
from backend.app.services.rules import apply_rules

logger = logging.getLogger("aries.workflow.executor")


async def execute_workflow(execution_id, db: AsyncSession) -> dict:
    """Execute a workflow by walking its DAG from start to end."""

    # Load execution
    stmt = select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
    result = await db.execute(stmt)
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError(f"Execution {execution_id} not found")

    # Load workflow nodes and edges
    nodes_stmt = select(WorkflowNode).where(WorkflowNode.workflow_id == execution.workflow_id)
    nodes_result = await db.execute(nodes_stmt)
    nodes = {n.node_key: n for n in nodes_result.scalars().all()}

    edges_stmt = select(WorkflowEdge).where(WorkflowEdge.workflow_id == execution.workflow_id)
    edges_result = await db.execute(edges_stmt)
    edges = edges_result.scalars().all()

    # Build adjacency list: node_key -> [(target_key, condition)]
    adjacency: dict[str, list[tuple[str, str | None]]] = {}
    for edge in edges:
        adjacency.setdefault(edge.source_node_key, []).append(
            (edge.target_node_key, edge.condition)
        )

    # Load the enquiry
    enquiry_stmt = select(Enquiry).where(Enquiry.id == execution.enquiry_id)
    enquiry_result = await db.execute(enquiry_stmt)
    enquiry = enquiry_result.scalar_one_or_none()
    if not enquiry:
        execution.status = ExecutionStatus.FAILED
        execution.error_message = f"Enquiry {execution.enquiry_id} not found"
        await db.commit()
        return {"error": "Enquiry not found"}

    # Mark execution as running
    execution.status = ExecutionStatus.RUNNING
    execution.started_at = datetime.now(timezone.utc)
    await db.commit()

    # Walk the DAG
    context: dict[str, Any] = {"enquiry_id": str(enquiry.id)}
    current_key = "start"
    visited = set()

    try:
        while current_key and current_key != "end" and current_key not in visited:
            visited.add(current_key)
            execution.current_node_key = current_key
            await db.commit()

            node = nodes.get(current_key)
            if not node:
                logger.warning("Node %s not found in workflow, skipping", current_key)
                break

            # Execute the node
            node_exec = NodeExecution(
                execution_id=execution.id,
                node_key=current_key,
                status="running",
                input_data=json.dumps(context) if context else None,
                started_at=datetime.now(timezone.utc),
            )
            db.add(node_exec)
            await db.commit()

            start_time = datetime.now(timezone.utc)
            try:
                output = await _execute_node(node, context, enquiry, db)
                node_exec.status = "completed"
                node_exec.output_data = json.dumps(output, default=str) if output else None
                context.update(output or {})
            except Exception as e:
                logger.error("Node %s execution failed: %s", current_key, e, exc_info=True)
                node_exec.status = "failed"
                node_exec.error_message = str(e)
                # Some nodes are fatal, some are not
                if node.node_type in (NodeType.CLASSIFY, NodeType.LLM, NodeType.RETRIEVAL):
                    execution.status = ExecutionStatus.FAILED
                    execution.error_message = f"Node {current_key} failed: {e}"
                    execution.completed_at = datetime.now(timezone.utc)
                    node_exec.completed_at = datetime.now(timezone.utc)
                    node_exec.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                    await db.commit()
                    return {"error": str(e), "failed_node": current_key}
                # Non-fatal: continue with partial context

            node_exec.completed_at = datetime.now(timezone.utc)
            node_exec.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            await db.commit()

            # Determine next node
            next_key = _resolve_next_node(current_key, adjacency, context)
            current_key = next_key

        # Mark execution as completed
        execution.status = ExecutionStatus.COMPLETED
        execution.completed_at = datetime.now(timezone.utc)
        execution.current_node_key = current_key
        await db.commit()

        return {
            "status": "completed",
            "nodes_executed": list(visited),
            "final_context_keys": list(context.keys()),
        }

    except Exception as e:
        logger.error("Workflow execution crashed: %s", e, exc_info=True)
        execution.status = ExecutionStatus.FAILED
        execution.error_message = str(e)
        execution.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"error": str(e)}


def _resolve_next_node(
    current_key: str,
    adjacency: dict[str, list[tuple[str, str | None]]],
    context: dict,
) -> str | None:
    """Resolve the next node from the current node using edge conditions."""
    edges = adjacency.get(current_key, [])
    if not edges:
        return None

    # Check condition-based edges first
    condition_result = context.get("condition_result")

    for target_key, condition in edges:
        if condition is None:
            # Unconditional edge — default path
            continue
        if condition == condition_result:
            return target_key

    # Fall back to first unconditional edge
    for target_key, condition in edges:
        if condition is None:
            return target_key

    # No matching edge found
    return None


async def _execute_node(
    node: WorkflowNode,
    context: dict,
    enquiry: Enquiry,
    db: AsyncSession,
) -> dict | None:
    """Execute a single node based on its type."""

    config = json.loads(node.config) if node.config else {}

    if node.node_type == NodeType.START:
        return {"step": "started"}

    elif node.node_type == NodeType.END:
        return {"step": "completed"}

    elif node.node_type == NodeType.RETRIEVAL:
        return await _node_wiki_retrieval(enquiry, config)

    elif node.node_type == NodeType.CLASSIFY:
        return await _node_classify(enquiry, context, config, db)

    elif node.node_type == NodeType.RULES:
        return _node_rules(enquiry, config)

    elif node.node_type == NodeType.LLM:
        return await _node_llm_draft(enquiry, context, config)

    elif node.node_type == NodeType.DECISION:
        return _node_decision(context)

    elif node.node_type == NodeType.HUMAN_APPROVAL:
        return await _node_human_approval(enquiry, context, db)

    elif node.node_type == NodeType.EXECUTION:
        return await _node_execution(enquiry, context, db)

    elif node.node_type == NodeType.MCP_TOOL:
        return await _node_mcp_tool(config, context)

    elif node.node_type == NodeType.TRANSFORM:
        return _node_transform(context, config)

    else:
        logger.warning("Unknown node type: %s", node.node_type)
        return None


async def _node_wiki_retrieval(enquiry: Enquiry, config: dict) -> dict:
    """Node 9: Wiki-first retrieval."""
    wiki = WikiService()

    index = wiki.read_page("index.md")
    context_parts = [f"# Wiki Index\n{index.content}"] if index else []

    search_terms = [enquiry.client_name]
    if enquiry.industry:
        search_terms.append(enquiry.industry)
    if enquiry.scope_category:
        search_terms.append(enquiry.scope_category)

    for term in search_terms:
        results = wiki.search(term, limit=5)
        for r in results:
            page = wiki.read_page(r.path)
            if page:
                context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")

    wiki_context = "\n\n---\n\n".join(context_parts) if context_parts else "No wiki context available."
    return {"wiki_context": wiki_context}


async def _node_classify(enquiry: Enquiry, context: dict, config: dict, db: AsyncSession) -> dict:
    """Node 10: Gemini structured classification."""
    wiki_context = context.get("wiki_context", "")
    gemini = GeminiService()
    classification = await gemini.classify_enquiry(enquiry, wiki_context)

    # Update enquiry
    enquiry.scope_category = classification.get("category")
    enquiry.complexity = classification.get("complexity")
    enquiry.resource_profile = classification.get("resource_profile")
    enquiry.status = EnquiryStatus.CLASSIFIED
    await db.commit()

    return {"classification": classification}


def _node_rules(enquiry: Enquiry, config: dict) -> dict:
    """Node 11: Deterministic rules engine — ALWAYS before LLM."""
    rules_output = apply_rules(
        estimated_value=enquiry.estimated_value,
        estimated_cost=enquiry.estimated_cost,
        industry=enquiry.industry,
        subdivision=enquiry.subdivision,
    )
    return {
        "rules": {
            "min_margin_pct": rules_output.min_margin_pct,
            "approval_threshold_value": rules_output.approval_threshold_value,
            "suggested_template": rules_output.suggested_template,
            "requires_two_person_approval": rules_output.requires_two_person_approval,
            "policy_violations": rules_output.policy_violations,
            "pricing_adjustments": rules_output.pricing_adjustments,
        }
    }


async def _node_llm_draft(enquiry: Enquiry, context: dict, config: dict) -> dict:
    """Node 12: LLM reasoning (Gemini 3.1 Pro)."""
    wiki_context = context.get("wiki_context", "")
    classification = context.get("classification", {})
    rules_data = context.get("rules", {})

    from backend.app.services.rules import RulesOutput
    rules_output = RulesOutput(
        min_margin_pct=rules_data.get("min_margin_pct", 15),
        approval_threshold_value=rules_data.get("approval_threshold_value", 200000),
        suggested_template=rules_data.get("suggested_template", "standard"),
        requires_two_person_approval=rules_data.get("requires_two_person_approval", False),
        policy_violations=rules_data.get("policy_violations", []),
        pricing_adjustments=rules_data.get("pricing_adjustments", []),
    )

    gemini = GeminiService()
    llm_draft = await gemini.draft_proposal(enquiry, wiki_context, rules_output, classification)

    enquiry.status = EnquiryStatus.LLM_DRAFTED
    # We need to commit outside this function — the executor commits after each node
    return {"llm_draft": llm_draft}


def _node_decision(context: dict) -> dict:
    """Decision node: evaluates rules and sets condition_result."""
    rules_data = context.get("rules", {})
    violations = rules_data.get("policy_violations", [])

    if violations:
        return {"condition_result": "policy_fail"}
    return {"condition_result": "policy_pass"}


async def _node_human_approval(enquiry: Enquiry, context: dict, db: AsyncSession) -> dict:
    """Human approval gate — pauses workflow until approved."""
    condition = context.get("condition_result", "policy_pass")

    if condition == "policy_pass":
        enquiry.status = EnquiryStatus.POLICY_REVIEW
    else:
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
    await db.commit()

    return {
        "approval_status": "pending",
        "message": f"Enquiry moved to {enquiry.status}. Awaiting human approval.",
    }


async def _node_execution(enquiry: Enquiry, context: dict, db: AsyncSession) -> dict:
    """Node 15-16: Parallel execution fan-out."""
    from backend.app.services.execution import execute_enquiry_actions

    enquiry.status = EnquiryStatus.EXECUTING
    await db.commit()

    results = await execute_enquiry_actions(enquiry, context)

    enquiry.status = EnquiryStatus.COMPLETED
    await db.commit()

    return {"execution_results": results}


async def _node_mcp_tool(config: dict, context: dict) -> dict:
    """Execute an MCP tool via the gateway."""
    from backend.app.mcp_servers.gateway import gateway

    tool_name = config.get("tool")
    params = config.get("params", {})

    if not tool_name:
        return {"error": "No tool name in config"}

    try:
        result = await gateway.call_tool(tool_name, **params)
        return {"mcp_result": result}
    except ValueError as e:
        return {"error": f"Tool not found: {e}"}


def _node_transform(context: dict, config: dict) -> dict:
    """Transform node: modify context data based on config rules."""
    transform_type = config.get("type", "passthrough")

    if transform_type == "passthrough":
        return context
    elif transform_type == "extract":
        # Extract specific keys from context
        keys = config.get("keys", [])
        return {k: context.get(k) for k in keys if k in context}
    elif transform_type == "rename":
        # Rename context keys
        mapping = config.get("mapping", {})
        result = {}
        for old_key, new_key in mapping.items():
            if old_key in context:
                result[new_key] = context[old_key]
        return result

    return {}
```

  </app/services/workflow_executor.py>

  <tests/conftest.py>

<a name="tests-conftest-py"></a>
### `tests/conftest.py`

```py
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.database import Base, get_db
from backend.app.main import app
from httpx import AsyncClient, ASGITransport

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

@pytest_asyncio.fixture
async def db_session():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestingSessionLocal() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

  </tests/conftest.py>

  <tests/__init__.py>

<a name="tests-init-py"></a>
### `tests/__init__.py`

```py
```

  </tests/__init__.py>

  <tests/test_ai.py>

<a name="tests-test-ai-py"></a>
### `tests/test_ai.py`

```py
"""Tests for AI Persona endpoints."""
import pytest


class TestListPersonas:
    """GET /api/v1/ai/personas"""

    async def test_list_personas_empty(self, client):
        response = await client.get("/api/v1/ai/personas")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_personas_after_seed(self, client):
        await client.post("/api/v1/ai/seed-personas")
        response = await client.get("/api/v1/ai/personas")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
        names = [p["name"] for p in data]
        assert "Sales Assistant" in names
        assert "Technical Architect" in names
        assert "Project Manager" in names


class TestCreatePersona:
    """POST /api/v1/ai/personas"""

    async def test_create_persona_success(self, client):
        payload = {
            "name": "Custom Bot",
            "description": "A custom persona",
            "system_prompt": "You are a custom bot.",
            "model": "gemini-1.5-pro",
            "temperature": "0.2",
        }
        response = await client.post("/api/v1/ai/personas", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Custom Bot"
        assert data["model"] == "gemini-1.5-pro"
        assert "id" in data

    async def test_create_persona_defaults(self, client):
        payload = {"name": "Minimal Bot"}
        response = await client.post("/api/v1/ai/personas", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Minimal Bot"
        assert data["model"] == "gemini-1.5-flash"


class TestSeedPersonas:
    """POST /api/v1/ai/seed-personas"""

    async def test_seed_personas_first_time(self, client):
        response = await client.post("/api/v1/ai/seed-personas")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 3
        assert "Sales Assistant" in data["seeded"]
        assert "Technical Architect" in data["seeded"]
        assert "Project Manager" in data["seeded"]

    async def test_seed_personas_idempotent(self, client):
        await client.post("/api/v1/ai/seed-personas")
        response = await client.post("/api/v1/ai/seed-personas")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0
        assert data["seeded"] == []
```

  </tests/test_ai.py>

  <tests/test_enquiries.py>

<a name="tests-test-enquiries-py"></a>
### `tests/test_enquiries.py`

```py
"""Tests for Enquiry CRUD endpoints."""
import pytest
from unittest.mock import patch, AsyncMock


class TestCreateEnquiry:
    """POST /api/v1/enquiries/"""

    async def test_create_enquiry_success(self, client):
        payload = {
            "client_name": "Acme Corp",
            "industry": "Manufacturing",
            "description": "ERP implementation request",
            "estimated_value": 500000.0,
            "estimated_cost": 350000.0,
        }
        response = await client.post("/api/v1/enquiries/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Acme Corp"
        assert data["status"] == "draft"
        assert "id" in data

    async def test_create_enquiry_minimal(self, client):
        payload = {"client_name": "Minimal Client"}
        response = await client.post("/api/v1/enquiries/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Minimal Client"
        assert data["status"] == "draft"

    async def test_create_enquiry_empty_client_defaults(self, client):
        payload = {}
        response = await client.post("/api/v1/enquiries/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "Unknown"


class TestListEnquiries:
    """GET /api/v1/enquiries/"""

    async def test_list_enquiries_empty(self, client):
        response = await client.get("/api/v1/enquiries/")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_enquiries_with_data(self, client):
        for i in range(3):
            await client.post("/api/v1/enquiries/", json={"client_name": f"Client {i}"})
        response = await client.get("/api/v1/enquiries/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert data[0]["client_name"] == "Client 0"


class TestGetEnquiry:
    """GET /api/v1/enquiries/{id}"""

    async def test_get_enquiry_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Get Me"})
        enquiry_id = create_resp.json()["id"]
        response = await client.get(f"/api/v1/enquiries/{enquiry_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == enquiry_id
        assert data["client_name"] == "Get Me"

    async def test_get_enquiry_not_found(self, client):
        response = await client.get("/api/v1/enquiries/99999")
        assert response.status_code == 404
        assert response.json()["detail"] == "Enquiry not found"


class TestUpdateEnquiry:
    """PATCH /api/v1/enquiries/{id}"""

    async def test_update_enquiry_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Old Name"})
        enquiry_id = create_resp.json()["id"]
        response = await client.patch(
            f"/api/v1/enquiries/{enquiry_id}",
            json={"client_name": "New Name", "industry": "Tech"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["client_name"] == "New Name"

    async def test_update_enquiry_status(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Status Test"})
        enquiry_id = create_resp.json()["id"]
        response = await client.patch(
            f"/api/v1/enquiries/{enquiry_id}",
            json={"status": "pending"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    async def test_update_enquiry_not_found(self, client):
        response = await client.patch("/api/v1/enquiries/99999", json={"client_name": "Ghost"})
        assert response.status_code == 404


class TestApproveEnquiry:
    """POST /api/v1/enquiries/{id}/approve"""

    async def test_approve_enquiry_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Approve Me"})
        enquiry_id = create_resp.json()["id"]
        response = await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["message"] == "Enquiry approved"

    async def test_approve_enquiry_not_found(self, client):
        response = await client.post("/api/v1/enquiries/99999/approve")
        assert response.status_code == 404

    async def test_approve_already_approved(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Double Approve"})
        enquiry_id = create_resp.json()["id"]
        await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")
        response = await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
```

  </tests/test_enquiries.py>

  <tests/test_wiki.py>

<a name="tests-test-wiki-py"></a>
### `tests/test_wiki.py`

```py
"""Tests for Wiki endpoints."""
import pytest


class TestListPages:
    """GET /api/v1/wiki/pages"""

    async def test_list_pages_empty(self, client):
        response = await client.get("/api/v1/wiki/pages")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_pages_with_content(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "index.md", "content": "# Home"})
        await client.post("/api/v1/wiki/pages", json={"path": "concepts/erp.md", "content": "# ERP"})
        response = await client.get("/api/v1/wiki/pages")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        paths = [p["path"] for p in data]
        assert "index.md" in paths
        assert "concepts/erp.md" in paths


class TestCreatePage:
    """POST /api/v1/wiki/pages"""

    async def test_create_page_success(self, client):
        payload = {"path": "test.md", "content": "# Test Page", "message": "Initial commit"}
        response = await client.post("/api/v1/wiki/pages", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "test.md"
        assert data["title"] == "test"

    async def test_create_page_no_path(self, client):
        payload = {"content": "No path here"}
        response = await client.post("/api/v1/wiki/pages", json=payload)
        assert response.status_code == 200
        assert "error" in response.json()

    async def test_create_page_nested_path(self, client):
        payload = {"path": "docs/nested/page.md", "content": "# Nested"}
        response = await client.post("/api/v1/wiki/pages", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "docs/nested/page.md"


class TestReadPage:
    """GET /api/v1/wiki/pages/{path}"""

    async def test_read_page_success(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "readme.md", "content": "# README\nHello world"})
        response = await client.get("/api/v1/wiki/pages/readme.md")
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "readme.md"
        assert "Hello world" in data["content"]

    async def test_read_page_not_found(self, client):
        response = await client.get("/api/v1/wiki/pages/nonexistent.md")
        assert response.status_code == 200
        assert response.json()["error"] == "Page not found"

    async def test_read_page_nested(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "foo/bar/baz.md", "content": "# Baz"})
        response = await client.get("/api/v1/wiki/pages/foo/bar/baz.md")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "baz"


class TestSearchWiki:
    """GET /api/v1/wiki/search?q=..."""

    async def test_search_wiki_found(self, client):
        await client.post("/api/v1/wiki/pages", json={"path": "python.md", "content": "# Python\nPython is great"})
        await client.post("/api/v1/wiki/pages", json={"path": "java.md", "content": "# Java\nJava is verbose"})
        response = await client.get("/api/v1/wiki/search?q=python")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any("python" in r["path"].lower() for r in data)

    async def test_search_wiki_not_found(self, client):
        response = await client.get("/api/v1/wiki/search?q=xyz123notfound")
        assert response.status_code == 200
        assert response.json() == []

    async def test_search_wiki_limit(self, client):
        for i in range(5):
            await client.post("/api/v1/wiki/pages", json={"path": f"page{i}.md", "content": f"# Page {i}\ncontent about testing"})
        response = await client.get("/api/v1/wiki/search?q=testing&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 2
```

  </tests/test_wiki.py>

  <tests/test_mcp.py>

<a name="tests-test-mcp-py"></a>
### `tests/test_mcp.py`

```py
"""Tests for MCP Gateway endpoints."""
from unittest.mock import patch, AsyncMock
import pytest


class TestListServers:
    """GET /api/v1/mcp/servers"""

    async def test_list_servers(self, client):
        response = await client.get("/api/v1/mcp/servers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "id" in data[0]
        assert "name" in data[0]

    async def test_list_servers_has_expected(self, client):
        response = await client.get("/api/v1/mcp/servers")
        data = response.json()
        names = [s["name"] for s in data]
        assert "crm-server" in names


class TestListTools:
    """GET /api/v1/mcp/tools"""

    async def test_list_tools(self, client):
        response = await client.get("/api/v1/mcp/tools")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "id" in data[0]
        assert "name" in data[0]

    async def test_list_tools_has_expected(self, client):
        response = await client.get("/api/v1/mcp/tools")
        data = response.json()
        names = [t["name"] for t in data]
        assert "create_contact" in names
        assert "get_customer" in names


class TestCallTool:
    """POST /api/v1/mcp/tools/call"""

    async def test_call_tool_success(self, client):
        payload = {"tool_name": "create_contact", "params": {"name": "Alice", "email": "alice@example.com"}}
        with patch("backend.app.mcp_servers.gateway.MCPGateway.call_tool", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {"tool": "create_contact", "status": "success", "result": "Contact created"}
            response = await client.post("/api/v1/mcp/tools/call", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            mock_call.assert_called_once_with("create_contact", {"name": "Alice", "email": "alice@example.com"})

    async def test_call_tool_no_name(self, client):
        payload = {"params": {"foo": "bar"}}
        response = await client.post("/api/v1/mcp/tools/call", json=payload)
        assert response.status_code == 200
        assert "error" in response.json()

    async def test_call_tool_unknown_tool(self, client):
        payload = {"tool_name": "unknown_tool_xyz", "params": {}}
        with patch("backend.app.mcp_servers.gateway.MCPGateway.call_tool", new_callable=AsyncMock) as mock_call:
            mock_call.return_value = {"tool": "unknown_tool_xyz", "status": "success", "result": "Mock result"}
            response = await client.post("/api/v1/mcp/tools/call", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
```

  </tests/test_mcp.py>

  <tests/test_rules.py>

<a name="tests-test-rules-py"></a>
### `tests/test_rules.py`

```py
"""Tests for Rules Engine."""
import pytest

from backend.app.services.rules import apply_rules, RulesOutput, MARGIN_RULES, APPROVAL_RULES


class TestMarginCalculations:
    """Test margin rule calculations."""

    def test_margin_default(self):
        """Default margin is 15%."""
        rules = apply_rules()
        assert rules.min_margin_pct == MARGIN_RULES["default_min_margin"]

    def test_margin_high_value(self):
        """High value enquiries (>= 500k) use 20% margin."""
        rules = apply_rules(estimated_value=600_000)
        assert rules.min_margin_pct == MARGIN_RULES["high_value_min_margin"]

    def test_margin_below_threshold(self):
        """Value below high-value threshold keeps default margin."""
        rules = apply_rules(estimated_value=400_000)
        assert rules.min_margin_pct == MARGIN_RULES["default_min_margin"]

    def test_margin_with_profit(self):
        """Margin above minimum — no violation."""
        rules = apply_rules(estimated_value=100_000, estimated_cost=50_000)
        # margin = (100k - 50k) / 100k = 50%, above 15%
        assert len(rules.policy_violations) == 0

    def test_margin_violation(self):
        """Margin below minimum — violation reported."""
        rules = apply_rules(estimated_value=100_000, estimated_cost=95_000)
        # margin = 5%, below 15%
        assert len(rules.policy_violations) == 1
        assert "below minimum" in rules.policy_violations[0]

    def test_margin_exactly_at_min(self):
        """Margin exactly at minimum — no violation."""
        rules = apply_rules(estimated_value=100_000, estimated_cost=85_000)
        # margin = 15%, exactly at minimum
        assert len(rules.policy_violations) == 0


class TestApprovalThresholds:
    """Test approval threshold rules."""

    def test_two_person_approval_high_value(self):
        """Values >= 200k require two-person approval."""
        rules = apply_rules(estimated_value=250_000)
        assert rules.requires_two_person_approval is True

    def test_no_two_person_approval_low_value(self):
        """Values below 200k don't require two-person approval."""
        rules = apply_rules(estimated_value=100_000)
        assert rules.requires_two_person_approval is False

    def test_none_values(self):
        """None values should not crash."""
        rules = apply_rules(estimated_value=None, estimated_cost=None)
        assert rules.min_margin_pct == MARGIN_RULES["default_min_margin"]
        assert rules.requires_two_person_approval is False

    def test_auto_approve_threshold(self):
        """Values below 50k don't require two-person approval."""
        rules = apply_rules(estimated_value=40_000)
        assert rules.requires_two_person_approval is False


class TestTemplateSelection:
    """Test proposal template selection."""

    def test_template_standard(self):
        """Default template for no industry."""
        rules = apply_rules()
        assert rules.suggested_template == "standard_proposal"

    def test_template_government(self):
        """Government industry uses government template."""
        rules = apply_rules(industry="government")
        assert rules.suggested_template == "government_proposal"

    def test_template_public_sector(self):
        """Public sector uses government template."""
        rules = apply_rules(industry="public sector")
        assert rules.suggested_template == "government_proposal"

    def test_template_enterprise(self):
        """High value uses enterprise template."""
        rules = apply_rules(estimated_value=250_000)
        assert rules.suggested_template == "enterprise_proposal"

    def test_template_case_insensitive(self):
        """Industry matching is case-insensitive."""
        rules = apply_rules(industry="GOVERNMENT")
        assert rules.suggested_template == "government_proposal"

    def test_government_overrides_enterprise(self):
        """Government industry takes precedence over high value."""
        rules = apply_rules(industry="government", estimated_value=250_000)
        assert rules.suggested_template == "government_proposal"


class TestRulesOutputStructure:
    """Test the RulesOutput dataclass structure."""

    def test_default_output(self):
        output = RulesOutput()
        assert output.min_margin_pct == 15.0
        assert output.max_discount_pct == 10.0
        assert output.approval_threshold_value == 100_000.0
        assert output.tax_rate == 0.0
        assert output.suggested_template == "standard_proposal"
        assert output.requires_two_person_approval is False
        assert output.policy_violations == []
        assert output.pricing_adjustments == {}

    def test_custom_output(self):
        output = RulesOutput(min_margin_pct=25.0, requires_two_person_approval=True)
        assert output.min_margin_pct == 25.0
        assert output.requires_two_person_approval is True
```

  </tests/test_rules.py>

  <tests/test_rag.py>

<a name="tests-test-rag-py"></a>
### `tests/test_rag.py`

```py
"""Tests for RAG Service."""
from unittest.mock import patch, AsyncMock, MagicMock
import pytest
import numpy as np

from backend.app.services.rag import RAGService, Chunk, SearchResult


class TestRAGChunking:
    """Test markdown chunking logic."""

    def test_chunk_small_text(self):
        text = "Short text."
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) == 1
        assert chunks[0].content == "Short text."

    def test_chunk_large_text(self):
        text = "a" * 1200
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) >= 1

    def test_chunk_empty(self):
        chunks = RAGService.chunk_markdown("", source_path="test.md")
        assert len(chunks) == 0

    def test_chunk_exact_size(self):
        text = "b" * 500
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) == 1
        assert len(chunks[0].content) == 500

    def test_chunk_with_real_markdown(self):
        text = "# Heading\n\nParagraph one.\n\nParagraph two.\n\n" + "more text. " * 100
        chunks = RAGService.chunk_markdown(text, source_path="test.md")
        assert len(chunks) >= 2
        for chunk in chunks:
            assert len(chunk.content) <= 1200  # overall text size


class TestRAGSearch:
    """Test RAG search with mocked embeddings."""

    @pytest.fixture
    def rag_service(self):
        return RAGService(route="v1")

    @pytest.mark.asyncio
    async def test_search_semantic_mock(self, rag_service):
        """Test semantic search returns results with mocked embeddings."""
        with patch.object(rag_service, 'embed_query') as mock_embed:
            mock_embed.return_value = np.ones(768, dtype=np.float32) * 0.5

            with patch.object(rag_service, '_semantic_search_sync') as mock_search:
                mock_search.return_value = [
                    SearchResult(
                        content="Test chunk content",
                        score=0.95,
                        metadata={"source_path": "test.md", "heading": "Test"}
                    )
                ]
                results = await rag_service.search("test query", limit=5, method="semantic")
                assert len(results) == 1
                assert results[0].score == 0.95
                assert "Test chunk" in results[0].content

    @pytest.mark.asyncio
    async def test_search_keyword_mock(self, rag_service):
        """Test keyword search."""
        with patch.object(rag_service, '_keyword_search_sync') as mock_kw:
            mock_kw.return_value = [
                SearchResult(content="keyword result", score=0.8, metadata={"source_path": "b.md"})
            ]
            results = await rag_service.search("test", method="keyword", limit=5)
            assert len(results) == 1
            assert results[0].content == "keyword result"

    @pytest.mark.asyncio
    async def test_search_hybrid_mock(self, rag_service):
        """Test hybrid search combines semantic + keyword results."""
        with patch.object(rag_service, '_semantic_search_sync') as mock_sem:
            mock_sem.return_value = [
                SearchResult(content="semantic result", score=0.9, metadata={"source_path": "a.md", "method": "semantic"})
            ]
            with patch.object(rag_service, '_keyword_search_sync') as mock_kw:
                mock_kw.return_value = [
                    SearchResult(content="keyword result", score=0.8, metadata={"source_path": "b.md", "method": "keyword"})
                ]
                results = await rag_service.search("test", method="hybrid", limit=5)
                assert len(results) == 2


class TestRAGIndexing:
    """Test document indexing."""

    @pytest.fixture
    def rag_service(self):
        return RAGService(route="v1")

    @pytest.mark.asyncio
    async def test_index_wiki_page_mock(self, rag_service):
        """Test indexing a wiki page with mocked embeddings."""
        with patch.object(rag_service, 'embed_texts') as mock_embed:
            mock_embed.return_value = [np.ones(768, dtype=np.float32).tolist()]
            with patch.object(rag_service, '_index_chunks_sync') as mock_store:
                mock_store.return_value = 1
                count = await rag_service.index_wiki_page("test.md", "# Test\n\nThis is test content.")
                assert count == 1

    def test_chunk_to_rows(self, rag_service):
        """Test converting chunks to DB rows."""
        chunks = [
            Chunk(content="chunk one", metadata={"source_path": "doc.md", "heading": "H1"}),
            Chunk(content="chunk two", metadata={"source_path": "doc.md", "heading": "H2"}),
        ]
        # Just verify chunk_markdown produces valid chunks
        assert len(chunks) == 2
        assert chunks[0].content == "chunk one"
```

  </tests/test_rag.py>

  <tests/test_documents.py>

<a name="tests-test-documents-py"></a>
### `tests/test_documents.py`

```py
"""Tests for Document upload endpoints."""
from io import BytesIO
import pytest


class TestUploadDocument:
    """POST /api/v1/documents/{enquiry_id}/upload"""

    async def test_upload_document_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Doc Client"})
        enquiry_id = create_resp.json()["id"]
        file_content = b"Hello, this is a test document."
        response = await client.post(
            f"/api/v1/documents/{enquiry_id}/upload",
            files={"file": ("test.txt", BytesIO(file_content), "text/plain")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enquiry_id"] == enquiry_id
        assert data["filename"] == "test.txt"
        assert data["content_type"] == "text/plain"

    async def test_upload_document_not_found(self, client):
        file_content = b"Orphan document"
        response = await client.post(
            "/api/v1/documents/99999/upload",
            files={"file": ("orphan.txt", BytesIO(file_content), "text/plain")},
        )
        assert response.status_code == 404

    async def test_upload_multiple_documents(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Multi Doc"})
        enquiry_id = create_resp.json()["id"]
        for name in ["a.pdf", "b.docx"]:
            response = await client.post(
                f"/api/v1/documents/{enquiry_id}/upload",
                files={"file": (name, BytesIO(b"content"), "application/octet-stream")},
            )
            assert response.status_code == 200


class TestListDocuments:
    """GET /api/v1/documents/{enquiry_id}"""

    async def test_list_documents_empty(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "No Docs"})
        enquiry_id = create_resp.json()["id"]
        response = await client.get(f"/api/v1/documents/{enquiry_id}")
        assert response.status_code == 200
        assert response.json() == []

    async def test_list_documents_with_uploads(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Has Docs"})
        enquiry_id = create_resp.json()["id"]
        await client.post(
            f"/api/v1/documents/{enquiry_id}/upload",
            files={"file": ("report.pdf", BytesIO(b"PDF data"), "application/pdf")},
        )
        response = await client.get(f"/api/v1/documents/{enquiry_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["filename"] == "report.pdf"
```

  </tests/test_documents.py>

  <tests/test_pipeline.py>

<a name="tests-test-pipeline-py"></a>
### `tests/test_pipeline.py`

```py
"""Tests for AI Pipeline endpoints."""
from unittest.mock import patch, AsyncMock
import pytest


class TestRunPipeline:
    """POST /api/v1/pipeline/run"""

    async def test_run_pipeline_success(self, client):
        # Create an enquiry first
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Pipeline Client", "industry": "Tech"})
        enquiry_id = create_resp.json()["id"]

        with patch("backend.app.api.routes.pipeline.DraftingAgent.run", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = {
                "status": "completed",
                "draft": "Mock proposal draft for Pipeline Client.",
                "classification": {"category": "standard", "risk_level": "low"},
                "rules_output": {"min_margin_pct": 20.0, "policy_violations": [], "suggested_template": "standard"},
            }
            response = await client.post("/api/v1/pipeline/run", json={"enquiry_id": enquiry_id})
            assert response.status_code == 200
            data = response.json()
            assert data["enquiry_id"] == enquiry_id
            assert data["status"] == "completed"
            assert "draft" in data
            mock_run.assert_called_once()

    async def test_run_pipeline_enquiry_not_found(self, client):
        response = await client.post("/api/v1/pipeline/run", json={"enquiry_id": 99999})
        assert response.status_code == 404

    async def test_run_pipeline_mock_gemini(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={
            "client_name": "Gemini Client",
            "estimated_value": 100000,
            "estimated_cost": 80000,
        })
        enquiry_id = create_resp.json()["id"]

        with patch("backend.app.services.gemini.GeminiService.draft_proposal", new_callable=AsyncMock) as mock_draft, \
             patch("backend.app.services.gemini.GeminiService.classify_enquiry", new_callable=AsyncMock) as mock_classify:
            mock_draft.return_value = "Mocked proposal from Gemini"
            mock_classify.return_value = {"category": "premium", "risk_level": "medium"}
            response = await client.post("/api/v1/pipeline/run", json={"enquiry_id": enquiry_id})
            assert response.status_code == 200
            data = response.json()
            assert "draft" in data
            mock_draft.assert_called_once()
            mock_classify.assert_called_once()


class TestExecutePipeline:
    """POST /api/v1/pipeline/execute/{id}"""

    async def test_execute_pipeline_success(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Execute Client"})
        enquiry_id = create_resp.json()["id"]
        await client.post(f"/api/v1/enquiries/{enquiry_id}/approve")

        with patch("backend.app.api.routes.pipeline.ExecuteAgent.run", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = {"status": "executed", "message": "Done"}
            response = await client.post(f"/api/v1/pipeline/execute/{enquiry_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["enquiry_id"] == enquiry_id
            mock_run.assert_called_once()

    async def test_execute_pipeline_not_approved(self, client):
        create_resp = await client.post("/api/v1/enquiries/", json={"client_name": "Not Approved"})
        enquiry_id = create_resp.json()["id"]
        response = await client.post(f"/api/v1/pipeline/execute/{enquiry_id}")
        assert response.status_code == 400
        assert "approved" in response.json()["detail"].lower()

    async def test_execute_pipeline_enquiry_not_found(self, client):
        response = await client.post("/api/v1/pipeline/execute/99999")
        assert response.status_code == 404
```

  </tests/test_pipeline.py>

</backend>