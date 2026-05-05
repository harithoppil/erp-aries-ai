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
