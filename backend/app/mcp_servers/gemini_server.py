"""Gemini MCP Server — call Gemini 3.1 Pro via MCP protocol."""

from mcp.server.fastmcp import FastMCP

from backend.app.services.gemini import GeminiService

gemini_mcp = FastMCP("Gemini MCP", instructions="Call Gemini 3.1 Pro for reasoning, classification, and drafting")


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
    """Draft a proposal using Gemini 3.1 Pro."""
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
