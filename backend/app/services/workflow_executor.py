"""DAG Workflow Executor — reads nodes/edges from DB and executes in topological order.

Each node type has a dedicated handler. The executor walks the DAG from
the start node, following edges (respecting conditions), and records
per-node execution with timing, input/output, and errors.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

# TODO: Migrate _node_wiki_retrieval to use shared helper from backend.app.services.wiki_context.build_wiki_context

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.workflow import (
    WorkflowExecution, ExecutionStatus, NodeExecution,
    WorkflowNode, NodeType, WorkflowEdge,
)
from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.services.wiki import WikiService
from backend.app.services.gemini import GeminiService, GeminiError
from backend.app.services.rules import apply_rules

logger = logging.getLogger("aries.workflow.executor")


async def execute_workflow(execution_id, db: AsyncSession) -> dict:
    """Execute a workflow by walking its DAG from start to end."""

    # Load execution
    stmt = select(WorkflowExecution).where(WorkflowExecution.id == execution_id)
    result = await db.execute(stmt)
    execution = result.scalar_one_or_none()
    if not execution:
        raise ValueError(f"Execution {execution_id} not found")

    # Load workflow nodes and edges
    nodes_stmt = select(WorkflowNode).where(WorkflowNode.workflow_id == execution.workflow_id)
    nodes_result = await db.execute(nodes_stmt)
    nodes = {n.node_key: n for n in nodes_result.scalars().all()}

    edges_stmt = select(WorkflowEdge).where(WorkflowEdge.workflow_id == execution.workflow_id)
    edges_result = await db.execute(edges_stmt)
    edges = edges_result.scalars().all()

    # Build adjacency list: node_key -> [(target_key, condition)]
    adjacency: dict[str, list[tuple[str, str | None]]] = {}
    for edge in edges:
        adjacency.setdefault(edge.source_node_key, []).append(
            (edge.target_node_key, edge.condition)
        )

    # Load the enquiry
    enquiry_stmt = select(Enquiry).where(Enquiry.id == execution.enquiry_id)
    enquiry_result = await db.execute(enquiry_stmt)
    enquiry = enquiry_result.scalar_one_or_none()
    if not enquiry:
        execution.status = ExecutionStatus.FAILED
        execution.error_message = f"Enquiry {execution.enquiry_id} not found"
        await db.commit()
        return {"error": "Enquiry not found"}

    # Mark execution as running
    execution.status = ExecutionStatus.RUNNING
    execution.started_at = datetime.now(timezone.utc)
    await db.commit()

    # Walk the DAG
    context: dict[str, Any] = {"enquiry_id": str(enquiry.id)}
    current_key = "start"
    visited = set()

    try:
        while current_key and current_key != "end" and current_key not in visited:
            visited.add(current_key)
            execution.current_node_key = current_key
            await db.commit()

            node = nodes.get(current_key)
            if not node:
                logger.warning("Node %s not found in workflow, skipping", current_key)
                break

            # Execute the node
            node_exec = NodeExecution(
                execution_id=execution.id,
                node_key=current_key,
                status="running",
                input_data=json.dumps(context) if context else None,
                started_at=datetime.now(timezone.utc),
            )
            db.add(node_exec)
            await db.commit()

            start_time = datetime.now(timezone.utc)
            try:
                output = await _execute_node(node, context, enquiry, db)
                node_exec.status = "completed"
                node_exec.output_data = json.dumps(output, default=str) if output else None
                context.update(output or {})
            except Exception as e:
                logger.error("Node %s execution failed: %s", current_key, e, exc_info=True)
                node_exec.status = "failed"
                node_exec.error_message = str(e)
                # Some nodes are fatal, some are not
                if node.node_type in (NodeType.CLASSIFY, NodeType.LLM, NodeType.RETRIEVAL):
                    execution.status = ExecutionStatus.FAILED
                    execution.error_message = f"Node {current_key} failed: {e}"
                    execution.completed_at = datetime.now(timezone.utc)
                    node_exec.completed_at = datetime.now(timezone.utc)
                    node_exec.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                    await db.commit()
                    return {"error": str(e), "failed_node": current_key}
                # Non-fatal: continue with partial context

            node_exec.completed_at = datetime.now(timezone.utc)
            node_exec.duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            await db.commit()

            # Determine next node
            next_key = _resolve_next_node(current_key, adjacency, context)
            current_key = next_key

        # Mark execution as completed
        execution.status = ExecutionStatus.COMPLETED
        execution.completed_at = datetime.now(timezone.utc)
        execution.current_node_key = current_key
        await db.commit()

        return {
            "status": "completed",
            "nodes_executed": list(visited),
            "final_context_keys": list(context.keys()),
        }

    except Exception as e:
        logger.error("Workflow execution crashed: %s", e, exc_info=True)
        execution.status = ExecutionStatus.FAILED
        execution.error_message = str(e)
        execution.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"error": str(e)}


def _resolve_next_node(
    current_key: str,
    adjacency: dict[str, list[tuple[str, str | None]]],
    context: dict,
) -> str | None:
    """Resolve the next node from the current node using edge conditions."""
    edges = adjacency.get(current_key, [])
    if not edges:
        return None

    # Check condition-based edges first
    condition_result = context.get("condition_result")

    for target_key, condition in edges:
        if condition is None:
            # Unconditional edge — default path
            continue
        if condition == condition_result:
            return target_key

    # Fall back to first unconditional edge
    for target_key, condition in edges:
        if condition is None:
            return target_key

    # No matching edge found
    return None


async def _execute_node(
    node: WorkflowNode,
    context: dict,
    enquiry: Enquiry,
    db: AsyncSession,
) -> dict | None:
    """Execute a single node based on its type."""

    config = json.loads(node.config) if node.config else {}

    if node.node_type == NodeType.START:
        return {"step": "started"}

    elif node.node_type == NodeType.END:
        return {"step": "completed"}

    elif node.node_type == NodeType.RETRIEVAL:
        return await _node_wiki_retrieval(enquiry, config)

    elif node.node_type == NodeType.CLASSIFY:
        return await _node_classify(enquiry, context, config, db)

    elif node.node_type == NodeType.RULES:
        return _node_rules(enquiry, config)

    elif node.node_type == NodeType.LLM:
        return await _node_llm_draft(enquiry, context, config)

    elif node.node_type == NodeType.DECISION:
        return _node_decision(context)

    elif node.node_type == NodeType.HUMAN_APPROVAL:
        return await _node_human_approval(enquiry, context, db)

    elif node.node_type == NodeType.EXECUTION:
        return await _node_execution(enquiry, context, db)

    elif node.node_type == NodeType.MCP_TOOL:
        return await _node_mcp_tool(config, context)

    elif node.node_type == NodeType.TRANSFORM:
        return _node_transform(context, config)

    else:
        logger.warning("Unknown node type: %s", node.node_type)
        return None


async def _node_wiki_retrieval(enquiry: Enquiry, config: dict) -> dict:
    """Node 9: Wiki-first retrieval."""
    wiki = WikiService()

    index = wiki.read_page("index.md")
    context_parts = [f"# Wiki Index\n{index.content}"] if index else []

    search_terms = [enquiry.client_name]
    if enquiry.industry:
        search_terms.append(enquiry.industry)
    if enquiry.scope_category:
        search_terms.append(enquiry.scope_category)

    for term in search_terms:
        results = wiki.search(term, limit=5)
        for r in results:
            page = wiki.read_page(r.path)
            if page:
                context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")

    wiki_context = "\n\n---\n\n".join(context_parts) if context_parts else "No wiki context available."
    return {"wiki_context": wiki_context}


async def _node_classify(enquiry: Enquiry, context: dict, config: dict, db: AsyncSession) -> dict:
    """Node 10: Gemini structured classification."""
    wiki_context = context.get("wiki_context", "")
    gemini = GeminiService()
    classification = await gemini.classify_enquiry(enquiry, wiki_context)

    # Update enquiry
    enquiry.scope_category = classification.get("category")
    enquiry.complexity = classification.get("complexity")
    enquiry.resource_profile = classification.get("resource_profile")
    enquiry.status = EnquiryStatus.CLASSIFIED
    await db.commit()

    return {"classification": classification}


def _node_rules(enquiry: Enquiry, config: dict) -> dict:
    """Node 11: Deterministic rules engine — ALWAYS before LLM."""
    rules_output = apply_rules(
        estimated_value=enquiry.estimated_value,
        estimated_cost=enquiry.estimated_cost,
        industry=enquiry.industry,
        subdivision=enquiry.subdivision,
    )
    return {
        "rules": {
            "min_margin_pct": rules_output.min_margin_pct,
            "approval_threshold_value": rules_output.approval_threshold_value,
            "suggested_template": rules_output.suggested_template,
            "requires_two_person_approval": rules_output.requires_two_person_approval,
            "policy_violations": rules_output.policy_violations,
            "pricing_adjustments": rules_output.pricing_adjustments,
        }
    }


async def _node_llm_draft(enquiry: Enquiry, context: dict, config: dict) -> dict:
    """Node 12: LLM reasoning (Gemini 3.1 Pro)."""
    wiki_context = context.get("wiki_context", "")
    classification = context.get("classification", {})
    rules_data = context.get("rules", {})

    from backend.app.services.rules import RulesOutput
    rules_output = RulesOutput(
        min_margin_pct=rules_data.get("min_margin_pct", 15),
        approval_threshold_value=rules_data.get("approval_threshold_value", 200000),
        suggested_template=rules_data.get("suggested_template", "standard"),
        requires_two_person_approval=rules_data.get("requires_two_person_approval", False),
        policy_violations=rules_data.get("policy_violations", []),
        pricing_adjustments=rules_data.get("pricing_adjustments", []),
    )

    gemini = GeminiService()
    llm_draft = await gemini.draft_proposal(enquiry, wiki_context, rules_output, classification)

    enquiry.status = EnquiryStatus.LLM_DRAFTED
    # We need to commit outside this function — the executor commits after each node
    return {"llm_draft": llm_draft}


def _node_decision(context: dict) -> dict:
    """Decision node: evaluates rules and sets condition_result."""
    rules_data = context.get("rules", {})
    violations = rules_data.get("policy_violations", [])

    if violations:
        return {"condition_result": "policy_fail"}
    return {"condition_result": "policy_pass"}


async def _node_human_approval(enquiry: Enquiry, context: dict, db: AsyncSession) -> dict:
    """Human approval gate — pauses workflow until approved."""
    condition = context.get("condition_result", "policy_pass")

    if condition == "policy_pass":
        enquiry.status = EnquiryStatus.POLICY_REVIEW
    else:
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
    await db.commit()

    return {
        "approval_status": "pending",
        "message": f"Enquiry moved to {enquiry.status}. Awaiting human approval.",
    }


async def _node_execution(enquiry: Enquiry, context: dict, db: AsyncSession) -> dict:
    """Node 15-16: Parallel execution fan-out."""
    from backend.app.services.execution import execute_enquiry_actions

    enquiry.status = EnquiryStatus.EXECUTING
    await db.commit()

    results = await execute_enquiry_actions(enquiry, context)

    enquiry.status = EnquiryStatus.COMPLETED
    await db.commit()

    return {"execution_results": results}


async def _node_mcp_tool(config: dict, context: dict) -> dict:
    """Execute an MCP tool via the gateway."""
    from backend.app.mcp_servers.gateway import gateway

    tool_name = config.get("tool")
    params = config.get("params", {})

    if not tool_name:
        return {"error": "No tool name in config"}

    try:
        result = await gateway.call_tool(tool_name, **params)
        return {"mcp_result": result}
    except ValueError as e:
        return {"error": f"Tool not found: {e}"}


def _node_transform(context: dict, config: dict) -> dict:
    """Transform node: modify context data based on config rules."""
    transform_type = config.get("type", "passthrough")

    if transform_type == "passthrough":
        return context
    elif transform_type == "extract":
        # Extract specific keys from context
        keys = config.get("keys", [])
        return {k: context.get(k) for k in keys if k in context}
    elif transform_type == "rename":
        # Rename context keys
        mapping = config.get("mapping", {})
        result = {}
        for old_key, new_key in mapping.items():
            if old_key in context:
                result[new_key] = context[old_key]
        return result

    return {}
