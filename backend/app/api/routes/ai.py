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

from backend.app.core.auth import get_current_user
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
    current_user=Depends(get_current_user),
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
async def get_persona(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
async def create_persona(
    data: PersonaCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
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
async def get_dashboard(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
async def create_dashboard(
    data: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
async def seed_personas(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
    current_user=Depends(get_current_user),
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
async def rag_index_wiki(
    route: str = "v2",
    current_user=Depends(get_current_user),
):
    """Index all wiki pages into the RAG vector store.

    Route: 'v2' (gemini-embedding-2, default) or 'v1' (gemini-embedding-001)
    """
    rag = RAGService(route=route)
    result = await rag.index_wiki_all()
    result["route"] = route
    result["model"] = rag.model
    return result


@router.post("/rag/index-page")
async def rag_index_page(
    path: str,
    route: str = "v2",
    current_user=Depends(get_current_user),
):
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
    current_user=Depends(get_current_user),
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
async def rag_stats(current_user=Depends(get_current_user)):
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
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
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
async def run_wiki_maintenance(current_user=Depends(get_current_user)):
    """Run the wiki maintenance loop (G5): re-index, update index.md, check orphans."""
    from backend.app.services.wiki_loop import run_wiki_maintenance
    return await run_wiki_maintenance()
