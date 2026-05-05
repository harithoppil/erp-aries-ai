"""Workflow API — CRUD for DAG pipeline definitions + execution.

Create, read, update workflows (nodes + edges), and execute them
against enquiries. Replaces the hardcoded Python pipeline.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_user
from backend.app.core.database import get_db
from backend.app.models.workflow import (
    Workflow, WorkflowStatus, WorkflowNode, NodeType, WorkflowEdge,
    WorkflowExecution, ExecutionStatus, NodeExecution,
)
from backend.app.services.workflow_executor import execute_workflow

router = APIRouter(prefix="/workflows", tags=["workflows"])


# --- Schemas ---

class NodeCreate(BaseModel):
    node_key: str
    node_type: NodeType
    label: str
    description: str | None = None
    config: dict | None = None
    position_x: int = 0
    position_y: int = 0


class EdgeCreate(BaseModel):
    source_node_key: str
    target_node_key: str
    condition: str | None = None


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None
    nodes: list[NodeCreate] = []
    edges: list[EdgeCreate] = []


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: WorkflowStatus | None = None
    is_default: bool | None = None


class ExecutionCreate(BaseModel):
    workflow_id: uuid.UUID
    enquiry_id: uuid.UUID


# --- Workflow CRUD ---

@router.get("/")
async def list_workflows(
    status: WorkflowStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    stmt = select(Workflow)
    if status:
        stmt = stmt.where(Workflow.status == status)
    result = await db.execute(stmt.order_by(Workflow.created_at.desc()))
    workflows = result.scalars().all()
    return [
        {
            "id": str(w.id),
            "name": w.name,
            "description": w.description,
            "version": w.version,
            "status": w.status,
            "is_default": w.is_default,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in workflows
    ]


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    result = await db.execute(stmt)
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    # Load nodes and edges
    nodes_stmt = select(WorkflowNode).where(WorkflowNode.workflow_id == workflow.id)
    nodes_result = await db.execute(nodes_stmt)
    nodes = nodes_result.scalars().all()

    edges_stmt = select(WorkflowEdge).where(WorkflowEdge.workflow_id == workflow.id)
    edges_result = await db.execute(edges_stmt)
    edges = edges_result.scalars().all()

    return {
        "id": str(workflow.id),
        "name": workflow.name,
        "description": workflow.description,
        "version": workflow.version,
        "status": workflow.status,
        "is_default": workflow.is_default,
        "nodes": [
            {
                "id": str(n.id),
                "node_key": n.node_key,
                "node_type": n.node_type,
                "label": n.label,
                "description": n.description,
                "config": json.loads(n.config) if n.config else None,
                "position_x": n.position_x,
                "position_y": n.position_y,
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": str(e.id),
                "source_node_key": e.source_node_key,
                "target_node_key": e.target_node_key,
                "condition": e.condition,
            }
            for e in edges
        ],
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
    }


@router.post("/")
async def create_workflow(
    data: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    workflow = Workflow(
        name=data.name,
        description=data.description,
        status=WorkflowStatus.DRAFT,
    )
    db.add(workflow)
    await db.flush()

    for node_data in data.nodes:
        node = WorkflowNode(
            workflow_id=workflow.id,
            node_key=node_data.node_key,
            node_type=node_data.node_type,
            label=node_data.label,
            description=node_data.description,
            config=json.dumps(node_data.config) if node_data.config else None,
            position_x=node_data.position_x,
            position_y=node_data.position_y,
        )
        db.add(node)

    for edge_data in data.edges:
        edge = WorkflowEdge(
            workflow_id=workflow.id,
            source_node_key=edge_data.source_node_key,
            target_node_key=edge_data.target_node_key,
            condition=edge_data.condition,
        )
        db.add(edge)

    await db.commit()
    await db.refresh(workflow)
    return {"id": str(workflow.id), "name": workflow.name, "status": workflow.status}


@router.patch("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    data: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    result = await db.execute(stmt)
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    if data.name is not None:
        workflow.name = data.name
    if data.description is not None:
        workflow.description = data.description
    if data.status is not None:
        workflow.status = data.status
    if data.is_default is not None:
        workflow.is_default = data.is_default

    await db.commit()
    return {"id": str(workflow.id), "name": workflow.name, "status": workflow.status}


# --- Node / Edge management ---

@router.post("/{workflow_id}/nodes")
async def add_node(
    workflow_id: str,
    data: NodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    wf_stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    wf_result = await db.execute(wf_stmt)
    if not wf_result.scalar_one_or_none():
        raise HTTPException(404, "Workflow not found")

    node = WorkflowNode(
        workflow_id=uuid.UUID(workflow_id),
        node_key=data.node_key,
        node_type=data.node_type,
        label=data.label,
        description=data.description,
        config=json.dumps(data.config) if data.config else None,
        position_x=data.position_x,
        position_y=data.position_y,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return {"id": str(node.id), "node_key": node.node_key, "node_type": node.node_type}


@router.post("/{workflow_id}/edges")
async def add_edge(
    workflow_id: str,
    data: EdgeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    wf_stmt = select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
    wf_result = await db.execute(wf_stmt)
    if not wf_result.scalar_one_or_none():
        raise HTTPException(404, "Workflow not found")

    edge = WorkflowEdge(
        workflow_id=uuid.UUID(workflow_id),
        source_node_key=data.source_node_key,
        target_node_key=data.target_node_key,
        condition=data.condition,
    )
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return {"id": str(edge.id), "source": edge.source_node_key, "target": edge.target_node_key}


# --- Workflow Execution ---

@router.post("/execute")
async def run_workflow(
    data: ExecutionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Execute a workflow for a given enquiry. Returns execution ID for tracking."""
    # Load workflow
    stmt = select(Workflow).where(Workflow.id == data.workflow_id)
    result = await db.execute(stmt)
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")
    if workflow.status != WorkflowStatus.ACTIVE:
        raise HTTPException(400, f"Workflow is {workflow.status}, must be active")

    # Create execution record
    execution = WorkflowExecution(
        workflow_id=data.workflow_id,
        enquiry_id=data.enquiry_id,
        status=ExecutionStatus.PENDING,
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Run the executor (async — it updates the execution record as it goes)
    try:
        result_data = await execute_workflow(execution.id, db)
        return {
            "execution_id": str(execution.id),
            "status": execution.status,
            "result": result_data,
        }
    except Exception as e:
        execution.status = ExecutionStatus.FAILED
        execution.error_message = str(e)
        await db.commit()
        raise HTTPException(500, f"Workflow execution failed: {e}")


@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    stmt = select(WorkflowExecution).where(WorkflowExecution.id == uuid.UUID(execution_id))
    result = await db.execute(stmt)
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(404, "Execution not found")

    # Load node executions
    ne_stmt = select(NodeExecution).where(NodeExecution.execution_id == execution.id)
    ne_result = await db.execute(ne_stmt)
    node_executions = ne_result.scalars().all()

    return {
        "id": str(execution.id),
        "workflow_id": str(execution.workflow_id),
        "enquiry_id": str(execution.enquiry_id),
        "status": execution.status,
        "current_node_key": execution.current_node_key,
        "error_message": execution.error_message,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
        "node_executions": [
            {
                "id": str(ne.id),
                "node_key": ne.node_key,
                "status": ne.status,
                "input_data": json.loads(ne.input_data) if ne.input_data else None,
                "output_data": json.loads(ne.output_data) if ne.output_data else None,
                "error_message": ne.error_message,
                "duration_ms": ne.duration_ms,
                "started_at": ne.started_at.isoformat() if ne.started_at else None,
                "completed_at": ne.completed_at.isoformat() if ne.completed_at else None,
            }
            for ne in node_executions
        ],
    }


@router.get("/{workflow_id}/executions")
async def list_executions(
    workflow_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    stmt = (
        select(WorkflowExecution)
        .where(WorkflowExecution.workflow_id == uuid.UUID(workflow_id))
        .order_by(WorkflowExecution.started_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    executions = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "enquiry_id": str(e.enquiry_id),
            "status": e.status,
            "current_node_key": e.current_node_key,
            "error_message": e.error_message,
            "started_at": e.started_at.isoformat() if e.started_at else None,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
        }
        for e in executions
    ]


# --- Seed default workflow ---

@router.post("/seed-default")
async def seed_default_workflow(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Seed the default Aries presales pipeline as a DB-stored DAG."""
    # Check if default already exists
    stmt = select(Workflow).where(Workflow.is_default == True)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(400, "Default workflow already exists")

    workflow = Workflow(
        name="Aries Presales Pipeline",
        description="Default enquiry pipeline: Wiki→Classify→Rules→LLM→PolicyGate→Approval→Execute",
        version=1,
        status=WorkflowStatus.ACTIVE,
        is_default=True,
    )
    db.add(workflow)
    await db.flush()

    # Nodes
    nodes = [
        WorkflowNode(workflow_id=workflow.id, node_key="start", node_type=NodeType.START, label="Start", position_x=0, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="wiki_retrieval", node_type=NodeType.RETRIEVAL, label="Wiki Retrieval",
                      description="Read index.md, follow links, search wiki", position_x=100, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="classify", node_type=NodeType.CLASSIFY, label="Classify",
                      description="Gemini 3 Flash structured classification", position_x=200, position_y=0,
                      config=json.dumps({"model": "gemini-3-flash-preview", "response_mime_type": "application/json"})),
        WorkflowNode(workflow_id=workflow.id, node_key="rules", node_type=NodeType.RULES, label="Rules Engine",
                      description="Deterministic margin/approval rules — always before LLM", position_x=300, position_y=0,
                      config=json.dumps({"min_margin_pct": 15, "approval_threshold": 200000})),
        WorkflowNode(workflow_id=workflow.id, node_key="llm_draft", node_type=NodeType.LLM, label="LLM Draft",
                      description="Gemini 3.1 Pro proposal drafting", position_x=400, position_y=0,
                      config=json.dumps({"model": "gemini-3.1-pro-preview"})),
        WorkflowNode(workflow_id=workflow.id, node_key="policy_gate", node_type=NodeType.DECISION, label="Policy Gate",
                      description="Check for policy violations", position_x=500, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="human_approval", node_type=NodeType.HUMAN_APPROVAL, label="Human Approval",
                      description="Two-person approval gate", position_x=600, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="execute", node_type=NodeType.EXECUTION, label="Execute",
                      description="Parallel fan-out: ERP, SAP, Outlook, PDF, Wiki", position_x=700, position_y=0),
        WorkflowNode(workflow_id=workflow.id, node_key="end", node_type=NodeType.END, label="End", position_x=800, position_y=0),
        # Branch from policy gate
        WorkflowNode(workflow_id=workflow.id, node_key="human_review", node_type=NodeType.HUMAN_APPROVAL, label="Human Review",
                      description="Manual review required due to policy violations", position_x=500, position_y=100),
    ]
    for node in nodes:
        db.add(node)

    # Edges (main path + branch)
    edges = [
        WorkflowEdge(workflow_id=workflow.id, source_node_key="start", target_node_key="wiki_retrieval"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="wiki_retrieval", target_node_key="classify"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="classify", target_node_key="rules"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="rules", target_node_key="llm_draft"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="llm_draft", target_node_key="policy_gate"),
        # Policy gate branches
        WorkflowEdge(workflow_id=workflow.id, source_node_key="policy_gate", target_node_key="human_approval", condition="policy_pass"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="policy_gate", target_node_key="human_review", condition="policy_fail"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="human_review", target_node_key="human_approval", condition="approved"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="human_approval", target_node_key="execute"),
        WorkflowEdge(workflow_id=workflow.id, source_node_key="execute", target_node_key="end"),
    ]
    for edge in edges:
        db.add(edge)

    await db.commit()
    return {"id": str(workflow.id), "name": workflow.name, "node_count": len(nodes), "edge_count": len(edges)}
