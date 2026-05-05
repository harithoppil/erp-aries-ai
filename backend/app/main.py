"""Aries Marine ERP — AI-Powered, MCP-Native Enterprise Resource Planning.

v3.1 — Full ERP with REAL AI (Gemini 2.5 Pro + MCP tool calling).
Double-entry accounting, real inventory, HR/Payroll, projects, CRM,
marine operations, and AI chat with live database queries.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.app.core.config import settings
from backend.app.core.database import init_db

# ── Route imports ──────────────────────────────────────────────
from backend.app.api.routes import auth
from backend.app.api.routes import companies
from backend.app.api.routes import sales
from backend.app.api.routes import purchasing
from backend.app.api.routes import inventory
from backend.app.api.routes import crm
from backend.app.api.routes import projects
from backend.app.api.routes import hr
from backend.app.api.routes import marine
from backend.app.api.routes import accounting
from backend.app.api.routes import reports
from backend.app.api.routes import dashboard
from backend.app.api.routes import settings as settings_routes
from backend.app.api.routes import assets

logger = logging.getLogger("aries.erp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Aries Marine ERP v%s starting...", settings.version)
    await init_db()
    logger.info("Database initialized.")
    yield
    logger.info("Shutting down Aries Marine ERP.")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="AI-Powered ERP for Aries Marine — Sales, Purchasing, Inventory, Accounting, HR, Projects, CRM, Marine Operations",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Mount routers ─────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router,          prefix=f"{API_PREFIX}/auth")
app.include_router(companies.router,     prefix=f"{API_PREFIX}")
app.include_router(sales.router,         prefix=f"{API_PREFIX}")
app.include_router(purchasing.router,    prefix=f"{API_PREFIX}")
app.include_router(inventory.router,     prefix=f"{API_PREFIX}")
app.include_router(crm.router,           prefix=f"{API_PREFIX}")
app.include_router(projects.router,      prefix=f"{API_PREFIX}")
app.include_router(hr.router,            prefix=f"{API_PREFIX}")
app.include_router(marine.router,        prefix=f"{API_PREFIX}")
app.include_router(accounting.router,    prefix=f"{API_PREFIX}")
app.include_router(reports.router,       prefix=f"{API_PREFIX}")
app.include_router(dashboard.router,     prefix=f"{API_PREFIX}")
app.include_router(settings_routes.router, prefix=f"{API_PREFIX}")
app.include_router(assets.router,        prefix=f"{API_PREFIX}")


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.version, "app": settings.app_name}


# ── AI Chat SSE Endpoint — REAL Gemini + MCP ──────────────────
@app.get(f"{API_PREFIX}/ai/chat")
async def ai_chat_stream(query: str, company_id: str = None):
    """SSE streaming endpoint for AI chat.

    Uses real Gemini 2.5 Pro with function calling to execute MCP tools
    against the live database. No hardcoded responses.
    """
    from backend.app.services.gemini import GeminiService

    service = GeminiService()

    async def event_generator():
        async for event in service.chat_stream(query=query, company_id=company_id):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


# ── Root ──────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": settings.version,
        "modules": [
            "Sales", "Purchasing", "Inventory", "Accounting",
            "CRM", "Projects", "HR/Payroll", "Marine Operations",
            "Fixed Assets", "Reports", "Dashboard", "AI Chat"
        ],
        "ai": "Gemini 2.5 Pro with MCP tool calling (live database queries)",
        "docs": "/docs",
    }
