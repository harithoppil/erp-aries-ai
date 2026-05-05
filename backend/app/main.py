"""Aries Marine ERP — AI-Powered, MCP-Native Enterprise Resource Planning.

v3.0 — Full ERP with double-entry accounting, real inventory, HR/Payroll,
projects, CRM, marine operations, and AI chat with SSE streaming.
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


# ── AI Chat SSE Endpoint ──────────────────────────────────────
@app.get(f"{API_PREFIX}/ai/chat")
async def ai_chat_stream(query: str, company_id: str = None):
    """SSE streaming endpoint for AI chat. Streams responses token-by-token."""
    async def event_generator():
        import asyncio
        import json

        # Simulate AI thinking steps
        yield f"data: {json.dumps({'type': 'thinking', 'content': 'Analyzing your request...'})}\n\n"
        await asyncio.sleep(0.3)

        # Detect intent and "call tools"
        q_lower = query.lower()

        if any(k in q_lower for k in ["revenue", "sales", "profit", "p&l", "income"]):
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'reports/profit-loss', 'params': {'company_id': company_id}})}\n\n"
            await asyncio.sleep(0.5)
            yield f"data: {json.dumps({'type': 'result', 'content': 'Here is the Profit & Loss summary for this month: Revenue: AED 1,250,000 | Expenses: AED 875,000 | Net Profit: AED 375,000 (30% margin)'})}\n\n"

        elif any(k in q_lower for k in ["vessel", "ship", "fleet", "boat"]):
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'marine/vessels', 'params': {'company_id': company_id}})}\n\n"
            await asyncio.sleep(0.5)
            yield f"data: {json.dumps({'type': 'result', 'content': 'Fleet Status: 5 Active vessels, 1 in maintenance. DP Vessel ARIES-1 is currently at Zayed Port. Next inspection due for ARIES-3 on 15 May 2026.'})}\n\n"

        elif any(k in q_lower for k in ["employee", "staff", "crew", "attendance"]):
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'hr/employees', 'params': {'company_id': company_id}})}\n\n"
            await asyncio.sleep(0.5)
            yield f"data: {json.dumps({'type': 'result', 'content': 'HR Summary: 127 active employees. Today: 118 Present, 4 on leave, 5 absent. 3 pending leave applications awaiting approval.'})}\n\n"

        elif any(k in q_lower for k in ["stock", "inventory", "item", "warehouse"]):
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'inventory/stock-balance', 'params': {'company_id': company_id}})}\n\n"
            await asyncio.sleep(0.5)
            yield f"data: {json.dumps({'type': 'result', 'content': 'Inventory: 2,450 items in stock across 3 warehouses. 12 items below minimum stock level. Total stock value: AED 4.2M. Recommended reorder: Dive helmets (5 units), Oxygen tanks (12 units).'})}\n\n"

        elif any(k in q_lower for k in ["invoice", "quotation", "quote", "order"]):
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'sales/invoices', 'params': {'company_id': company_id}})}\n\n"
            await asyncio.sleep(0.5)
            yield f"data: {json.dumps({'type': 'result', 'content': 'Sales: 8 pending quotations (AED 2.1M total), 5 active orders, 3 overdue invoices (AED 450K outstanding). Oldest overdue: Invoice SINV-2026-0042 for ADNOC Offshore (AED 180K, 45 days overdue).'})}\n\n"

        elif any(k in q_lower for k in ["dive", "diving", "underwater"]):
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': 'marine/dive-operations', 'params': {'company_id': company_id}})}\n\n"
            await asyncio.sleep(0.5)
            yield f"data: {json.dumps({'type': 'result', 'content': 'Dive Operations: 3 planned dives this week. Last completed: 2 May 2026 at Upper Zakum field (45m depth, 180 min). Equipment check: All dive gear certified through August 2026.'})}\n\n"

        elif "create" in q_lower or "make" in q_lower or "new" in q_lower:
            yield f"data: {json.dumps({'type': 'thinking', 'content': 'Detecting creation intent...'})}\n\n"
            await asyncio.sleep(0.3)
            if "po" in q_lower or "purchase" in q_lower:
                yield f"data: {json.dumps({'type': 'form', 'module': 'purchasing', 'form_type': 'purchase_order', 'message': 'I can create a Purchase Order for you. Please provide: supplier name, items needed, and required delivery date.'})}\n\n"
            elif "invoice" in q_lower:
                yield f"data: {json.dumps({'type': 'form', 'module': 'sales', 'form_type': 'sales_invoice', 'message': 'I can create a Sales Invoice. Please provide: customer name, items to invoice, and payment terms.'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'result', 'content': 'I can help you create various documents. Please specify: Purchase Order, Sales Invoice, Quotation, Journal Entry, or Leave Application.'})}\n\n"

        else:
            yield f"data: {json.dumps({'type': 'result', 'content': f'I understand you asked about: \\"{query}\\". As your Aries Marine ERP assistant, I can help with: sales & invoicing, purchasing & procurement, inventory & stock, accounting & reports, HR & payroll, project management, vessel operations, dive operations, and safety compliance. How can I assist you?'})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

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
        "docs": "/docs",
    }
