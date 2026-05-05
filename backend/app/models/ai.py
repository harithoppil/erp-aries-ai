"""AI Personas — Specialized agents with scoped access and RBAC.

Inspired by NocoBase's AI Employees (Dex, Viz, Avery pattern).
Each persona has: role, system prompt, allowed tools, allowed data sources,
and RBAC-scoped database access.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


class PersonaCategory(str, enum.Enum):
    BUSINESS = "business"
    TECHNICAL = "technical"
    DEVELOPER = "developer"


class Persona(Base):
    """AI Persona / Employee — a scoped agent role."""
    __tablename__ = "ai_personas"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True)  # e.g. "presales_assistant", "financial_analyst"
    nickname: Mapped[str] = mapped_column(String(100))  # Display name
    position: Mapped[str] = mapped_column(String(200))  # e.g. "Pre-sales Consultant"
    category: Mapped[PersonaCategory] = mapped_column(String(20), default=PersonaCategory.BUSINESS)

    # System prompt layers (NocoBase pattern: global + employee + personal)
    about: Mapped[str | None] = mapped_column(Text)  # Employee-specific prompt (the "constitution")
    greeting: Mapped[str | None] = mapped_column(Text)  # First message the AI sends

    # Model configuration
    model: Mapped[str] = mapped_column(String(100), default="gemini-3-flash-preview")
    temperature: Mapped[float] = mapped_column(default=0.7)

    # Tool and data scoping
    allowed_tools: Mapped[str | None] = mapped_column(Text)  # JSON array of MCP tool names
    allowed_collections: Mapped[str | None] = mapped_column(Text)  # JSON array of DB tables the persona can query
    allowed_mcp_servers: Mapped[str | None] = mapped_column(Text)  # JSON array of MCP server names

    # Knowledge base / RAG
    enable_knowledge_base: Mapped[bool] = mapped_column(Boolean, default=True)
    knowledge_base_prompt: Mapped[str | None] = mapped_column(Text)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    built_in: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    conversations: Mapped[list["AIConversation"]] = relationship(back_populates="persona", cascade="all, delete-orphan")


class AIConversation(Base):
    """Persistent conversation sessions with AI personas."""
    __tablename__ = "ai_conversations"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    persona_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("ai_personas.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(String(255), index=True)  # Entra ID / user identifier
    channel: Mapped[str] = mapped_column(String(50), default="web", index=True)  # web, whatsapp, telegram, slack
    title: Mapped[str | None] = mapped_column(String(200))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    persona: Mapped["Persona"] = relationship(back_populates="conversations")
    messages: Mapped[list["AIMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class AIMessage(Base):
    """Individual messages in AI conversations."""
    __tablename__ = "ai_messages"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("ai_conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(50))  # user, assistant, system, tool
    content: Mapped[str | None] = mapped_column(Text)
    tool_calls: Mapped[str | None] = mapped_column(Text)  # JSON array of tool calls
    tool_call_id: Mapped[str | None] = mapped_column(String(100))
    tool_name: Mapped[str | None] = mapped_column(String(100))
    metadata_json: Mapped[str | None] = mapped_column(Text)  # model, tokens, latency, etc.

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")


class ChannelConnector(Base):
    """Multi-channel connector configuration — WhatsApp, Telegram, Slack."""
    __tablename__ = "channel_connectors"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    channel_type: Mapped[str] = mapped_column(String(50))  # whatsapp, telegram, slack, email
    name: Mapped[str] = mapped_column(String(200))  # "Aries WhatsApp Bot"
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Connection config (encrypted in production, stored in Key Vault/Secret Manager)
    config: Mapped[str | None] = mapped_column(Text)  # JSON: {bot_token, phone_number_id, verify_token, etc.}
    webhook_url: Mapped[str | None] = mapped_column(String(500))

    # Which persona handles messages from this channel
    default_persona_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("ai_personas.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UIDashboard(Base):
    """AI-generated UI dashboards and forms (Mutator MCP output)."""
    __tablename__ = "ui_dashboards"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    ui_type: Mapped[str] = mapped_column(String(50))  # dashboard, form, report, kanban
    schema_json: Mapped[str] = mapped_column(Text)  # JSON schema that the Next.js frontend renders
    created_by_persona: Mapped[str | None] = mapped_column(String(100))  # which AI persona created it
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
