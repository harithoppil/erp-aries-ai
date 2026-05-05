"""Gemini service (Nodes 10, 12) — structured classification + LLM reasoning + PDF processing.

Uses Gemini 3 Flash for classification/OCR (cheaper, faster) and Gemini 2.5 Pro for reasoning.
All Gemini calls use tenacity retry with exponential backoff and proper error logging.
No exceptions are silently swallowed — failures are logged and surfaced.
"""

import json
import logging
from collections.abc import AsyncGenerator
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
CHAT_MODEL = "gemini-2.5-pro-preview-03-25"     # Chat streaming with function calling

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

    # --- Chat Streaming with Function Calling ---

    def _tool_declarations(self) -> list[dict]:
        """Return Gemini-compatible function declarations from MCP_TOOLS."""
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
    ):
        """Stream AI response with real function calling.

        Yields SSE-formatted JSON strings:
        - {"type": "thinking", "content": str}
        - {"type": "tool_call", "tool": str, "params": dict}
        - {"type": "tool_result", "tool": str, "result": dict}
        - {"type": "result", "content": str}
        - {"type": "done"}
        """
        import asyncio

        if not self.client:
            yield self._sse({"type": "result", "content": "AI service is not configured. Please set GEMINI_API_KEY in your environment."})
            yield self._sse({"type": "done"})
            return

        try:
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

            tool_list = [types.Tool(function_declarations=self._tool_declarations())]

            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=CHAT_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=tool_list,
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
                    tool_result = await self._execute_mcp_tool(tool_name, tool_args)
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
                    self.client.models.generate_content,
                    model=CHAT_MODEL,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=tool_list,
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
            logger.error(f"Gemini chat_stream error: {e}", exc_info=True)
            yield self._sse({"type": "result", "content": f"I encountered an error: {str(e)}. Please try again or contact support."})
            yield self._sse({"type": "done"})

    @staticmethod
    def _sse(data: dict) -> str:
        """Format data as SSE event."""
        return f"data: {json.dumps(data)}\n\n"

    async def _execute_mcp_tool(self, name: str, args: dict) -> dict:
        """Execute an MCP tool by name with the given arguments."""
        from backend.app.services.mcp_tools import MCPToolExecutor
        executor = MCPToolExecutor()
        return await executor.execute(name, args)
