"""Real Gemini 2.5 Pro integration with function calling.

Uses google-genai SDK for tool-calling, classification, and generation.
All responses stream via async generator for SSE.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from backend.app.core.config import settings

logger = logging.getLogger("aries.gemini")

# Tool definitions for Gemini function calling
MCP_TOOLS = [
    {
        "name": "query_sales",
        "description": "Query sales data: customers, quotations, sales orders, invoices, payments. Use when user asks about revenue, sales, invoices, quotations, customers, or outstanding amounts.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["customers", "quotations", "sales_orders", "invoices", "payments"], "description": "Which sales entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "filters": {"type": "object", "description": "Optional filters like status, date range, customer_id"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_purchasing",
        "description": "Query purchasing data: suppliers, purchase orders, receipts, purchase invoices. Use when user asks about procurement, suppliers, POs, or payables.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["suppliers", "purchase_orders", "purchase_receipts", "purchase_invoices"], "description": "Which purchasing entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "filters": {"type": "object", "description": "Optional filters"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_inventory",
        "description": "Query inventory/stock data: items, stock balance, stock ledger. Use when user asks about stock, inventory, items, warehouses, or stock levels.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["items", "stock_balance", "stock_ledger"], "description": "Which inventory entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "item_id": {"type": "string", "description": "Optional specific item UUID"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_accounting",
        "description": "Query accounting data: chart of accounts, journal entries, general ledger, financial reports. Use when user asks about accounting, GL, journal entries, P&L, balance sheet, or financial reports.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["accounts", "journal_entries", "general_ledger", "profit_loss", "balance_sheet"], "description": "Which accounting entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "from_date": {"type": "string", "description": "Start date (YYYY-MM-DD) for reports"},
                "to_date": {"type": "string", "description": "End date (YYYY-MM-DD) for reports"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_hr",
        "description": "Query HR data: employees, attendance, leave applications, salary slips, expense claims. Use when user asks about employees, staff, attendance, leave, or payroll.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["employees", "attendance", "leave_applications", "salary_slips", "expense_claims"], "description": "Which HR entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "employee_id": {"type": "string", "description": "Optional specific employee UUID"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_marine",
        "description": "Query marine operations data: vessels, dive operations, safety equipment, fuel logs, charter contracts, crew assignments, maintenance schedules. Use when user asks about vessels, fleet, dive operations, safety, fuel, or charters.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["vessels", "dive_operations", "safety_equipment", "fuel_logs", "charter_contracts", "crew_assignments", "maintenance_schedules"], "description": "Which marine entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "vessel_id": {"type": "string", "description": "Optional specific vessel UUID"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_projects",
        "description": "Query project data: projects, tasks, timesheets. Use when user asks about projects, tasks, or timesheets.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["projects", "tasks", "timesheets"], "description": "Which project entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "project_id": {"type": "string", "description": "Optional specific project UUID"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_crm",
        "description": "Query CRM data: leads, opportunities, communications. Use when user asks about leads, opportunities, or CRM.",
        "parameters": {
            "type": "object",
            "properties": {
                "entity": {"type": "string", "enum": ["leads", "opportunities", "communications"], "description": "Which CRM entity to query"},
                "company_id": {"type": "string", "description": "Company UUID"},
            },
            "required": ["entity", "company_id"],
        },
    },
    {
        "name": "query_dashboard",
        "description": "Get dashboard KPIs and summary data. Use when user asks for an overview, summary, KPIs, or dashboard data.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_id": {"type": "string", "description": "Company UUID"},
                "kpi_type": {"type": "string", "enum": ["summary", "sales_trend", "project_status", "vessel_status"], "description": "Which KPI to fetch"},
            },
            "required": ["company_id"],
        },
    },
    {
        "name": "create_document",
        "description": "Create a new ERP document. Use when user asks to create, make, or generate a new document like a PO, invoice, quotation, journal entry, etc.",
        "parameters": {
            "type": "object",
            "properties": {
                "doc_type": {"type": "string", "enum": ["purchase_order", "sales_invoice", "quotation", "journal_entry", "leave_application", "expense_claim"], "description": "Type of document to create"},
                "company_id": {"type": "string", "description": "Company UUID"},
                "details": {"type": "object", "description": "Document-specific details"},
            },
            "required": ["doc_type", "company_id"],
        },
    },
]


class GeminiService:
    """Real Gemini integration with function calling for ERP queries."""

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = "gemini-2.5-pro-preview-03-25"
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except ImportError:
                logger.error("google-genai not installed. AI features disabled.")
                return None
        return self._client

    def _tool_declarations(self) -> list[dict]:
        """Return Gemini-compatible function declarations."""
        declarations = []
        for tool in MCP_TOOLS:
            declarations.append({
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            })
        return declarations

    async def chat_stream(
        self,
        query: str,
        company_id: str | None,
        context: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream AI response with real function calling.

        Yields SSE-formatted JSON strings:
        - {"type": "thinking", "content": str}
        - {"type": "tool_call", "tool": str, "params": dict}
        - {"type": "tool_result", "tool": str, "result": dict}
        - {"type": "result", "content": str}
        - {"type": "done"}
        """
        import asyncio

        client = self._get_client()
        if not client or not self.api_key:
            yield self._sse({"type": "result", "content": "AI service is not configured. Please set GEMINI_API_KEY in your environment."})
            yield self._sse({"type": "done"})
            return

        try:
            from google.genai import types

            # System prompt
            system_prompt = f"""You are the Aries Marine ERP AI Assistant. You help users interact with their ERP system.
You have access to tools that query real business data from the database.
Company context: {company_id or 'not specified'}.

When the user asks about business data, use the appropriate tool to fetch it.
When the user wants to create a document, use the create_document tool.
Always respond concisely with specific numbers and facts.
Format currency values with AED prefix.
If data is empty, say so clearly — do not make up numbers."""

            contents = [
                types.Content(role="user", parts=[types.Part(text=query)]),
            ]

            # First turn: let Gemini decide if it needs tools
            yield self._sse({"type": "thinking", "content": "Analyzing your request..."})

            tools = [types.Tool(function_declarations=self._tool_declarations())]

            response = await asyncio.to_thread(
                client.models.generate_content,
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=tools,
                    tool_config=types.ToolConfig(
                        function_calling_config=types.FunctionCallingConfig(mode="AUTO")
                    ),
                ),
            )

            function_calls = []
            response_text = ""

            for candidate in response.candidates or []:
                for part in candidate.content.parts if candidate.content else []:
                    if part.function_call:
                        function_calls.append(part.function_call)
                    elif part.text:
                        response_text += part.text

            # If Gemini wants to call tools, execute them and send results back
            if function_calls:
                for fc in function_calls:
                    tool_name = fc.name
                    tool_args = dict(fc.args) if fc.args else {}

                    yield self._sse({"type": "tool_call", "tool": tool_name, "params": tool_args})

                    # Execute the tool
                    tool_result = await self._execute_tool(tool_name, tool_args)
                    yield self._sse({"type": "tool_result", "tool": tool_name, "result": tool_result})

                    # Add function result to conversation
                    contents.append(types.Content(role="model", parts=[
                        types.Part(function_call=fc)
                    ]))
                    contents.append(types.Content(role="user", parts=[
                        types.Part.from_function_response(
                            name=tool_name,
                            response={"result": tool_result},
                        )
                    ]))

                # Second turn: ask Gemini to summarize the tool results
                yield self._sse({"type": "thinking", "content": "Processing results..."})

                final_response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=self.model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=tools,
                    ),
                )

                final_text = ""
                for candidate in final_response.candidates or []:
                    for part in candidate.content.parts if candidate.content else []:
                        if part.text:
                            final_text += part.text

                if final_text.strip():
                    yield self._sse({"type": "result", "content": final_text.strip()})
                else:
                    yield self._sse({"type": "result", "content": "I've gathered the data you requested. Here are the results from the tool calls above."})

            elif response_text.strip():
                yield self._sse({"type": "result", "content": response_text.strip()})

            else:
                yield self._sse({"type": "result", "content": "I'm here to help with your Aries Marine ERP. I can query sales, inventory, vessels, employees, projects, accounting data, and more. What would you like to know?"})

            yield self._sse({"type": "done"})

        except Exception as e:
            logger.error(f"Gemini error: {e}", exc_info=True)
            yield self._sse({"type": "result", "content": f"I encountered an error: {str(e)}. Please try again or contact support."})
            yield self._sse({"type": "done"})

    def _sse(self, data: dict) -> str:
        """Format data as SSE event."""
        return f"data: {json.dumps(data)}\n\n"

    async def _execute_tool(self, name: str, args: dict) -> dict:
        """Execute an MCP tool by name with the given arguments."""
        from backend.app.services.mcp_tools import MCPToolExecutor
        executor = MCPToolExecutor()
        return await executor.execute(name, args)
