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

async def _erp_list_customers(company_id: str = "", limit: int = 20, search: str = "") -> str:
    from backend.app.mcp_servers.erp_server import erp_list_customers
    return await erp_list_customers(company_id, limit, search)


async def _erp_get_customer(customer_id: str) -> str:
    from backend.app.mcp_servers.erp_server import erp_get_customer
    return await erp_get_customer(customer_id)


async def _erp_list_sales_invoices(company_id: str = "", status: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_sales_invoices
    return await erp_list_sales_invoices(company_id, status, limit)


async def _erp_get_invoice(invoice_id: str) -> str:
    from backend.app.mcp_servers.erp_server import erp_get_invoice
    return await erp_get_invoice(invoice_id)


async def _erp_list_quotations(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_quotations
    return await erp_list_quotations(company_id, limit)


async def _erp_list_sales_orders(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_sales_orders
    return await erp_list_sales_orders(company_id, limit)


async def _erp_list_suppliers(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_suppliers
    return await erp_list_suppliers(company_id, limit)


async def _erp_list_purchase_orders(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_purchase_orders
    return await erp_list_purchase_orders(company_id, limit)


async def _erp_list_purchase_invoices(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_purchase_invoices
    return await erp_list_purchase_invoices(company_id, limit)


async def _erp_list_items(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_items
    return await erp_list_items(company_id, limit)


async def _erp_stock_balance(company_id: str) -> str:
    from backend.app.mcp_servers.erp_server import erp_stock_balance
    return await erp_stock_balance(company_id)


async def _erp_list_vessels(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_vessels
    return await erp_list_vessels(company_id, limit)


async def _erp_list_dive_operations(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_dive_operations
    return await erp_list_dive_operations(company_id, limit)


async def _erp_list_safety_equipment(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_safety_equipment
    return await erp_list_safety_equipment(company_id, limit)


async def _erp_list_employees(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_employees
    return await erp_list_employees(company_id, limit)


async def _erp_list_attendance(company_id: str = "") -> str:
    from backend.app.mcp_servers.erp_server import erp_list_attendance
    return await erp_list_attendance(company_id)


async def _erp_list_leave_applications(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_leave_applications
    return await erp_list_leave_applications(company_id, limit)


async def _erp_list_salary_slips(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_salary_slips
    return await erp_list_salary_slips(company_id, limit)


async def _erp_list_projects(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_projects
    return await erp_list_projects(company_id, limit)


async def _erp_list_project_tasks(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_project_tasks
    return await erp_list_project_tasks(company_id, limit)


async def _erp_list_timesheets(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_timesheets
    return await erp_list_timesheets(company_id, limit)


async def _erp_list_accounts(company_id: str = "", limit: int = 100) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_accounts
    return await erp_list_accounts(company_id, limit)


async def _erp_list_journal_entries(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_journal_entries
    return await erp_list_journal_entries(company_id, limit)


async def _erp_list_fixed_assets(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_fixed_assets
    return await erp_list_fixed_assets(company_id, limit)


async def _erp_list_leads(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_leads
    return await erp_list_leads(company_id, limit)


async def _erp_list_opportunities(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.erp_server import erp_list_opportunities
    return await erp_list_opportunities(company_id, limit)


def _register_erp_tools():
    gateway.register_tool("erp", MCPTool(
        name="erp_list_customers", description="List customers in the ERP", server="erp",
        handler=lambda company_id="", limit=20, search="": _erp_list_customers(company_id, limit, search), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_get_customer", description="Get a single customer by ID", server="erp",
        handler=lambda customer_id="": _erp_get_customer(customer_id), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_sales_invoices", description="List sales invoices in the ERP", server="erp",
        handler=lambda company_id="", status="", limit=20: _erp_list_sales_invoices(company_id, status, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_get_invoice", description="Get a single sales invoice by ID", server="erp",
        handler=lambda invoice_id="": _erp_get_invoice(invoice_id), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_quotations", description="List quotations in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_quotations(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_sales_orders", description="List sales orders in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_sales_orders(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_suppliers", description="List suppliers in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_suppliers(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_purchase_orders", description="List purchase orders in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_purchase_orders(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_purchase_invoices", description="List purchase invoices in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_purchase_invoices(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_items", description="List inventory items in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_items(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_stock_balance", description="Get stock balance by item and warehouse", server="erp",
        handler=lambda company_id="": _erp_stock_balance(company_id), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_vessels", description="List vessels in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_vessels(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_dive_operations", description="List dive operations in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_dive_operations(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_safety_equipment", description="List safety equipment in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_safety_equipment(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_employees", description="List employees in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_employees(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_attendance", description="List today's attendance records", server="erp",
        handler=lambda company_id="": _erp_list_attendance(company_id), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_leave_applications", description="List leave applications in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_leave_applications(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_salary_slips", description="List salary slips in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_salary_slips(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_projects", description="List projects in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_projects(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_project_tasks", description="List project tasks in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_project_tasks(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_timesheets", description="List timesheets in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_timesheets(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_accounts", description="List chart of accounts in the ERP", server="erp",
        handler=lambda company_id="", limit=100: _erp_list_accounts(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_journal_entries", description="List journal entries in the ERP", server="erp",
        handler=lambda company_id="", limit=20: _erp_list_journal_entries(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_fixed_assets", description="List fixed assets in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_fixed_assets(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_leads", description="List CRM leads in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_leads(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("erp", MCPTool(
        name="erp_list_opportunities", description="List CRM opportunities in the ERP", server="erp",
        handler=lambda company_id="", limit=50: _erp_list_opportunities(company_id, limit), requires_auth=True,
    ))


# ── SAP helpers ────────────────────────────────────────────────

async def _sap_material_master(query: str = "", company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_material_master
    return await sap_material_master(query, company_id, limit)


async def _sap_stock(sku: str = "", company_id: str = "") -> str:
    from backend.app.mcp_servers.sap_server import sap_stock
    return await sap_stock(sku, company_id)


async def _sap_customer_list(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_customer_list
    return await sap_customer_list(company_id, limit)


async def _sap_invoice_list(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_invoice_list
    return await sap_invoice_list(company_id, limit)


async def _sap_purchase_order_list(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_purchase_order_list
    return await sap_purchase_order_list(company_id, limit)


async def _sap_project_list(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_project_list
    return await sap_project_list(company_id, limit)


async def _sap_vessel_list(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_vessel_list
    return await sap_vessel_list(company_id, limit)


async def _sap_employee_list(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_employee_list
    return await sap_employee_list(company_id, limit)


async def _sap_account_list(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.sap_server import sap_account_list
    return await sap_account_list(company_id, limit)


async def _sap_general_ledger(company_id: str = "", limit: int = 50) -> str:
    from backend.app.mcp_servers.sap_server import sap_general_ledger
    return await sap_general_ledger(company_id, limit)


async def _sap_asset_list(company_id: str = "", limit: int = 20) -> str:
    from backend.app.mcp_servers.sap_server import sap_asset_list
    return await sap_asset_list(company_id, limit)


def _register_sap_tools():
    gateway.register_tool("sap", MCPTool(
        name="sap_material_master", description="Search SAP material master (read-only)", server="sap",
        handler=lambda q="", company_id="", limit=20: _sap_material_master(q, company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_stock", description="Check SAP stock for a SKU (read-only)", server="sap",
        handler=lambda sku="", company_id="": _sap_stock(sku, company_id), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_customer_list", description="Read-only list of customers", server="sap",
        handler=lambda company_id="", limit=20: _sap_customer_list(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_invoice_list", description="Read-only list of sales invoices", server="sap",
        handler=lambda company_id="", limit=20: _sap_invoice_list(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_purchase_order_list", description="Read-only list of purchase orders", server="sap",
        handler=lambda company_id="", limit=20: _sap_purchase_order_list(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_project_list", description="Read-only list of projects", server="sap",
        handler=lambda company_id="", limit=20: _sap_project_list(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_vessel_list", description="Read-only list of vessels", server="sap",
        handler=lambda company_id="", limit=20: _sap_vessel_list(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_employee_list", description="Read-only list of employees", server="sap",
        handler=lambda company_id="", limit=20: _sap_employee_list(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_account_list", description="Read-only chart of accounts", server="sap",
        handler=lambda company_id="", limit=50: _sap_account_list(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_general_ledger", description="Read-only general ledger entries", server="sap",
        handler=lambda company_id="", limit=50: _sap_general_ledger(company_id, limit), requires_auth=True,
    ))
    gateway.register_tool("sap", MCPTool(
        name="sap_asset_list", description="Read-only fixed assets list", server="sap",
        handler=lambda company_id="", limit=20: _sap_asset_list(company_id, limit), requires_auth=True,
    ))


# ── Outlook helpers ────────────────────────────────────────────

async def _outlook_list_communications(
    company_id: str = "",
    communication_type: str = "",
    reference_type: str = "",
    limit: int = 50,
) -> str:
    from backend.app.mcp_servers.outlook_server import outlook_list_communications
    return await outlook_list_communications(company_id, communication_type, reference_type, limit)


async def _outlook_get_communication(communication_id: str) -> str:
    from backend.app.mcp_servers.outlook_server import outlook_get_communication
    return await outlook_get_communication(communication_id)


async def _outlook_communications_by_reference(
    reference_type: str,
    reference_id: str,
    limit: int = 20,
) -> str:
    from backend.app.mcp_servers.outlook_server import outlook_communications_by_reference
    return await outlook_communications_by_reference(reference_type, reference_id, limit)


async def _outlook_summary_by_type(company_id: str = "") -> str:
    from backend.app.mcp_servers.outlook_server import outlook_summary_by_type
    return await outlook_summary_by_type(company_id)


async def _outlook_search_communications(
    query: str = "",
    company_id: str = "",
    limit: int = 20,
) -> str:
    from backend.app.mcp_servers.outlook_server import outlook_search_communications
    return await outlook_search_communications(query, company_id, limit)


def _register_outlook_tools():
    gateway.register_tool("outlook", MCPTool(
        name="outlook_list_communications", description="List CRM communication logs", server="outlook",
        handler=lambda company_id="", communication_type="", reference_type="", limit=50: _outlook_list_communications(company_id, communication_type, reference_type, limit), requires_auth=True,
    ))
    gateway.register_tool("outlook", MCPTool(
        name="outlook_get_communication", description="Get a single communication log by ID", server="outlook",
        handler=lambda communication_id="": _outlook_get_communication(communication_id), requires_auth=True,
    ))
    gateway.register_tool("outlook", MCPTool(
        name="outlook_communications_by_reference", description="Get communications linked to a reference", server="outlook",
        handler=lambda reference_type="", reference_id="", limit=20: _outlook_communications_by_reference(reference_type, reference_id, limit), requires_auth=True,
    ))
    gateway.register_tool("outlook", MCPTool(
        name="outlook_summary_by_type", description="Get communication summary by type", server="outlook",
        handler=lambda company_id="": _outlook_summary_by_type(company_id), requires_auth=True,
    ))
    gateway.register_tool("outlook", MCPTool(
        name="outlook_search_communications", description="Search communications by subject or content", server="outlook",
        handler=lambda query="", company_id="", limit=20: _outlook_search_communications(query, company_id, limit), requires_auth=True,
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
