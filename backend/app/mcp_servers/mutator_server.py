"""Mutator MCP Server — AI-generated UI forms, dashboards, reports, kanban boards.

These tools allow AI personas to generate dynamic UI components that the
Next.js frontend can render from JSON schemas. Inspired by NocoBase's
schema-based UI generation.

Tools:
- generate_ui_form: Generate a form schema for data entry
- generate_dashboard: Generate a dashboard with charts/stats
- generate_report: Generate a structured report layout
- generate_kanban: Generate a kanban board layout
"""

# PORTED — This MCP server is now registered in Next.js src/lib/mcp-gateway.ts
# Tool handlers run as async functions calling Prisma or Python microservice.

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db, async_session
from backend.app.models.ai import UIDashboard
from backend.app.mcp_servers.gateway import MCPTool, gateway

logger = logging.getLogger("aries.mcp.mutator")


def register_mutator_server():
    """Register the Mutator MCP server and its tools."""
    gateway.register_server("mutator", "AI-generated UI dashboards, forms, reports, kanban boards")

    gateway.register_tool("mutator", MCPTool(
        name="generate_ui_form",
        description="Generate a dynamic form UI schema from a description. Returns JSON that the frontend renders.",
        server="mutator",
        handler=_generate_ui_form,
        requires_auth=True,
    ))

    gateway.register_tool("mutator", MCPTool(
        name="generate_dashboard",
        description="Generate a dashboard UI with charts, stats, and tables from a description.",
        server="mutator",
        handler=_generate_dashboard,
        requires_auth=True,
    ))

    gateway.register_tool("mutator", MCPTool(
        name="generate_report",
        description="Generate a structured report layout with sections, charts, and data tables.",
        server="mutator",
        handler=_generate_report,
        requires_auth=True,
    ))

    gateway.register_tool("mutator", MCPTool(
        name="generate_kanban",
        description="Generate a kanban board layout with columns and cards from a workflow description.",
        server="mutator",
        handler=_generate_kanban,
        requires_auth=True,
    ))


async def _generate_ui_form(
    name: str = "Untitled Form",
    description: str = "",
    fields: str | None = None,
    persona: str = "system",
    target_collection: str | None = None,
) -> str:
    """Generate a form UI schema.

    Args:
        name: Form name
        description: What the form is for
        fields: JSON array of field definitions, or comma-separated field names
        persona: Which AI persona is creating this
        target_collection: DB collection/table this form submits to
    """
    # Parse fields
    if fields:
        try:
            field_defs = json.loads(fields) if fields.startswith("[") else [
                {"name": f.strip(), "type": "text", "label": f.strip().replace("_", " ").title()}
                for f in fields.split(",")
            ]
        except json.JSONDecodeError:
            field_defs = [{"name": "field1", "type": "text", "label": "Field 1"}]
    else:
        field_defs = [{"name": "field1", "type": "text", "label": "Field 1"}]

    # Build the schema
    schema = {
        "type": "form",
        "version": "1.0",
        "name": name,
        "description": description,
        "target_collection": target_collection,
        "layout": "vertical",
        "fields": field_defs,
        "actions": [
            {"type": "submit", "label": "Submit", "variant": "primary"},
            {"type": "reset", "label": "Reset", "variant": "secondary"},
        ],
        "validation": {
            field_def["name"]: {"required": True}
            for field_def in field_defs
        },
    }

    # Save to database
    dashboard_id = await _save_ui_schema(name, "form", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "form",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _generate_dashboard(
    name: str = "Untitled Dashboard",
    description: str = "",
    metrics: str | None = None,
    persona: str = "system",
    data_source: str | None = None,
) -> str:
    """Generate a dashboard UI schema with stats, charts, and tables.

    Args:
        name: Dashboard name
        description: What the dashboard shows
        metrics: Comma-separated metric names (e.g. "revenue,margin,enquiries,pipeline")
        persona: Which AI persona is creating this
        data_source: API endpoint or collection to fetch data from
    """
    metric_list = [m.strip() for m in metrics.split(",")] if metrics else ["total", "active", "completed"]

    # Build widgets from metrics
    widgets = []
    for i, metric in enumerate(metric_list):
        row = i // 3  # 3 widgets per row
        col = i % 3
        widgets.append({
            "id": f"widget_{metric}",
            "type": "stat_card",
            "title": metric.replace("_", " ").title(),
            "metric": metric,
            "data_source": data_source or f"/api/v1/erp/metrics/{metric}",
            "position": {"row": row, "col": col},
            "format": "number",
            "trend": True,
        })

    # Add a chart widget
    widgets.append({
        "id": "widget_chart",
        "type": "chart",
        "title": f"{name} Trend",
        "chart_type": "line",
        "data_source": data_source or "/api/v1/erp/metrics/trend",
        "position": {"row": (len(metric_list) // 3) + 1, "col": 0, "span": 3},
        "x_axis": "date",
        "y_axis": metric_list[:2],
    })

    # Add a table widget
    widgets.append({
        "id": "widget_table",
        "type": "table",
        "title": "Recent Items",
        "data_source": data_source or "/api/v1/erp/items",
        "position": {"row": (len(metric_list) // 3) + 2, "col": 0, "span": 3},
        "columns": ["name", "status", "value", "updated_at"],
        "pagination": True,
        "page_size": 10,
    })

    schema = {
        "type": "dashboard",
        "version": "1.0",
        "name": name,
        "description": description,
        "layout": "grid",
        "columns": 3,
        "widgets": widgets,
        "filters": [
            {"id": "date_range", "type": "date_range", "label": "Date Range"},
            {"id": "status_filter", "type": "select", "label": "Status", "options": ["all", "active", "completed"]},
        ],
        "refresh_interval": 30000,
    }

    dashboard_id = await _save_ui_schema(name, "dashboard", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "dashboard",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _generate_report(
    name: str = "Untitled Report",
    description: str = "",
    sections: str | None = None,
    persona: str = "system",
    data_source: str | None = None,
) -> str:
    """Generate a structured report layout.

    Args:
        name: Report name
        description: What the report covers
        sections: Comma-separated section names
        persona: Which AI persona is creating this
        data_source: API endpoint for report data
    """
    section_list = [s.strip() for s in sections.split(",")] if sections else ["Executive Summary", "Details", "Recommendations"]

    # Build sections
    report_sections = []
    for i, section_name in enumerate(section_list):
        section = {
            "id": f"section_{i}",
            "title": section_name,
            "type": "prose" if i == 0 else "table",
            "order": i,
        }

        if section_name.lower().find("summary") >= 0 or section_name.lower().find("executive") >= 0:
            section["type"] = "prose"
            section["ai_generated"] = True
        elif section_name.lower().find("chart") >= 0 or section_name.lower().find("visual") >= 0:
            section["type"] = "chart"
            section["chart_type"] = "bar"
            section["data_source"] = data_source or "/api/v1/erp/metrics"
        else:
            section["type"] = "table"
            section["data_source"] = data_source
            section["columns"] = ["item", "value", "status"]

        report_sections.append(section)

    schema = {
        "type": "report",
        "version": "1.0",
        "name": name,
        "description": description,
        "layout": "vertical",
        "sections": report_sections,
        "header": {
            "logo": True,
            "title": name,
            "subtitle": description,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        },
        "footer": {
            "generated_by": persona,
            "disclaimer": "This report was generated by an AI assistant. Please verify all data.",
        },
        "export_formats": ["pdf", "xlsx", "csv"],
    }

    dashboard_id = await _save_ui_schema(name, "report", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "report",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _generate_kanban(
    name: str = "Untitled Kanban",
    description: str = "",
    columns: str | None = None,
    persona: str = "system",
    data_source: str | None = None,
) -> str:
    """Generate a kanban board layout.

    Args:
        name: Kanban board name
        description: What workflow the kanban tracks
        columns: Comma-separated column names (e.g. "Backlog,In Progress,Review,Done")
        persona: Which AI persona is creating this
        data_source: API endpoint for kanban data
    """
    column_list = [c.strip() for c in columns.split(",")] if columns else ["Backlog", "In Progress", "Review", "Done"]

    kanban_columns = []
    for i, col_name in enumerate(column_list):
        kanban_columns.append({
            "id": f"col_{i}",
            "title": col_name,
            "status_key": col_name.lower().replace(" ", "_"),
            "position": i,
            "wip_limit": None,
            "card_template": {
                "title": "{{name}}",
                "subtitle": "{{client_name}}",
                "badge": "{{priority}}",
                "meta": "{{updated_at}}",
            },
        })

    schema = {
        "type": "kanban",
        "version": "1.0",
        "name": name,
        "description": description,
        "data_source": data_source or "/api/v1/enquiries",
        "columns": kanban_columns,
        "card_actions": ["move", "edit", "delete", "comment"],
        "filters": [
            {"id": "assignee", "type": "select", "label": "Assignee"},
            {"id": "priority", "type": "select", "label": "Priority", "options": ["low", "medium", "high", "critical"]},
        ],
        "drag_and_drop": True,
    }

    dashboard_id = await _save_ui_schema(name, "kanban", schema, persona)

    return json.dumps({
        "id": str(dashboard_id),
        "ui_type": "kanban",
        "name": name,
        "schema": schema,
    }, indent=2)


async def _save_ui_schema(name: str, ui_type: str, schema: dict, persona: str) -> uuid.UUID:
    """Save a UI schema to the database and return its ID."""
    dashboard = UIDashboard(
        name=name,
        ui_type=ui_type,
        schema_json=json.dumps(schema),
        created_by_persona=persona,
    )

    async with async_session() as db:
        db.add(dashboard)
        await db.commit()
        await db.refresh(dashboard)
        return dashboard.id
