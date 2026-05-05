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
from backend.app.mcp_servers.gateway import register_all_servers
from backend.app.api.routes.enquiries import router as enquiries_router
from backend.app.api.routes.documents import router as documents_router
from backend.app.api.routes.wiki import router as wiki_router
from backend.app.api.routes.pipeline import router as pipeline_router
from backend.app.api.routes.workflow import router as workflow_router
from backend.app.api.routes.ai import router as ai_router
from backend.app.api.routes.channels import router as channels_router
from backend.app.api.routes.accounting import router as accounting_router
from backend.app.api.routes.sales import router as sales_router
from backend.app.api.routes.purchasing import router as purchasing_router
from backend.app.api.routes.inventory import router as inventory_router
from backend.app.api.routes.crm import router as crm_router
from backend.app.api.routes.projects import router as projects_router
from backend.app.api.routes.hr import router as hr_router
from backend.app.api.routes.marine import router as marine_router
from backend.app.api.routes.assets import router as assets_router
from backend.app.api.routes.reports import router as reports_router
from backend.app.api.routes.dashboard import router as dashboard_router
from backend.app.api.routes.settings import router as settings_router
from backend.app.api.routes.auth import router as auth_router
from backend.app.api.routes.companies import router as companies_router

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

# JWT auth is handled per-route via Depends(get_current_user).
# The old APIKeyMiddleware is removed in favor of OAuth2PasswordBearer.

# Routes — v2.0 (enquiries, documents, wiki, pipeline, workflow, ai, channels)
app.include_router(enquiries_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(wiki_router, prefix="/api/v1")
app.include_router(pipeline_router, prefix="/api/v1")
app.include_router(workflow_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(channels_router, prefix="/api/v1")

# Routes — v3 ERP (auth must be first so it registers /auth/login before other deps)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(companies_router, prefix="/api/v1")
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(sales_router, prefix="/api/v1")
app.include_router(purchasing_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(crm_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(hr_router, prefix="/api/v1")
app.include_router(marine_router, prefix="/api/v1")
app.include_router(assets_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")


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
