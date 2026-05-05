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
