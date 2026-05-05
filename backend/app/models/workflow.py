"""DAG Pipeline Engine — DB-stored configurable workflow definitions.

Replaces the hardcoded Python pipeline (Nodes 9→13) with a database-stored
Directed Acyclic Graph that can be configured without code deployment.
Inspired by NocoBase's visual workflow builder pattern.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


class NodeType(str, enum.Enum):
    START = "start"
    END = "end"
    RETRIEVAL = "retrieval"
    CLASSIFY = "classify"
    RULES = "rules"
    LLM = "llm"
    DECISION = "decision"
    HUMAN_APPROVAL = "human_approval"
    EXECUTION = "execution"
    MCP_TOOL = "mcp_tool"
    TRANSFORM = "transform"


class WorkflowStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Workflow(Base):
    """A workflow definition — a DAG of nodes and edges."""
    __tablename__ = "workflows"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[WorkflowStatus] = mapped_column(String(20), default=WorkflowStatus.DRAFT)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    nodes: Mapped[list["WorkflowNode"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    edges: Mapped[list["WorkflowEdge"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    executions: Mapped[list["WorkflowExecution"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")


class WorkflowNode(Base):
    """A node in a workflow DAG."""
    __tablename__ = "workflow_nodes"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflows.id"), index=True)
    node_key: Mapped[str] = mapped_column(String(100))  # unique key within workflow e.g. "classify", "rules", "llm_draft"
    node_type: Mapped[NodeType] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)

    # Node configuration as JSON — varies by node_type
    # e.g. for LLM: {"model": "gemini-3.1-pro-preview", "prompt_template": "...", "structured_output_schema": "..."}
    # e.g. for RULES: {"rules_config": {"min_margin": 15, "approval_threshold": 200000}}
    # e.g. for MCP_TOOL: {"mcp_server": "wiki", "tool": "wiki_search", "params": {}}
    config: Mapped[str | None] = mapped_column(Text)  # JSON string

    position_x: Mapped[int] = mapped_column(Integer, default=0)  # For visual editor
    position_y: Mapped[int] = mapped_column(Integer, default=0)

    workflow: Mapped["Workflow"] = relationship(back_populates="nodes")


class WorkflowEdge(Base):
    """A directed edge connecting two nodes in a workflow DAG."""
    __tablename__ = "workflow_edges"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflows.id"), index=True)
    source_node_key: Mapped[str] = mapped_column(String(100))
    target_node_key: Mapped[str] = mapped_column(String(100))
    condition: Mapped[str | None] = mapped_column(String(200))  # e.g. "policy_pass", "policy_fail", None for unconditional

    workflow: Mapped["Workflow"] = relationship(back_populates="edges")


class WorkflowExecution(Base):
    """A single execution run of a workflow for an enquiry."""
    __tablename__ = "workflow_executions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflows.id"), index=True)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("enquiries.id"), index=True)
    status: Mapped[ExecutionStatus] = mapped_column(String(20), default=ExecutionStatus.PENDING)
    current_node_key: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    workflow: Mapped["Workflow"] = relationship(back_populates="executions")
    node_executions: Mapped[list["NodeExecution"]] = relationship(back_populates="execution", cascade="all, delete-orphan")


class NodeExecution(Base):
    """Execution record for a single node within a workflow run."""
    __tablename__ = "node_executions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    execution_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("workflow_executions.id"), index=True)
    node_key: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, running, completed, failed, skipped
    input_data: Mapped[str | None] = mapped_column(Text)  # JSON
    output_data: Mapped[str | None] = mapped_column(Text)  # JSON
    error_message: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    execution: Mapped["WorkflowExecution"] = relationship(back_populates="node_executions")
