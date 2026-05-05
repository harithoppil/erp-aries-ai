"""Outlook MCP Server — communication logs via CRM Communication model.

All tools query the real database using async SQLAlchemy.
No stubs, no hardcoded responses.
"""

import uuid
import json
import logging
from datetime import date

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import async_session
from backend.app.models.crm import Communication, Lead, Opportunity

logger = logging.getLogger("aries.mcp.outlook")


def _serialize(obj) -> dict:
    """Serialize a SQLAlchemy row to a dict."""
    from datetime import datetime
    result = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if val is None:
            result[col.name] = None
        elif isinstance(val, (datetime, date)):
            result[col.name] = val.isoformat()
        elif isinstance(val, uuid.UUID):
            result[col.name] = str(val)
        else:
            result[col.name] = val
    return result


async def outlook_list_communications(
    company_id: str = "",
    communication_type: str = "",
    reference_type: str = "",
    limit: int = 50,
) -> str:
    """List communication logs from the CRM."""
    async with async_session() as db:
        q = select(Communication).where(Communication.is_active == True)
        if company_id:
            q = q.where(Communication.company_id == uuid.UUID(company_id))
        if communication_type:
            q = q.where(Communication.communication_type == communication_type)
        if reference_type:
            q = q.where(Communication.reference_type == reference_type)
        rows = (await db.execute(q.order_by(Communication.communication_date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} communications:\n" + json.dumps(data, indent=2, default=str)


async def outlook_get_communication(communication_id: str) -> str:
    """Get a single communication log by ID."""
    async with async_session() as db:
        row = (await db.execute(
            select(Communication).where(Communication.id == uuid.UUID(communication_id))
        )).scalar_one_or_none()
        if not row:
            return f"Communication not found: {communication_id}"
        return json.dumps(_serialize(row), indent=2, default=str)


async def outlook_communications_by_reference(
    reference_type: str,
    reference_id: str,
    limit: int = 20,
) -> str:
    """Get communications linked to a specific reference (e.g. Lead, Opportunity, Customer)."""
    async with async_session() as db:
        q = select(Communication).where(
            Communication.is_active == True,
            Communication.reference_type == reference_type,
            Communication.reference_id == uuid.UUID(reference_id),
        )
        rows = (await db.execute(q.order_by(Communication.communication_date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} communications for {reference_type} {reference_id}:\n" + json.dumps(data, indent=2, default=str)


async def outlook_summary_by_type(company_id: str = "") -> str:
    """Get a summary count of communications grouped by type."""
    async with async_session() as db:
        q = select(
            Communication.communication_type,
            func.count().label("count"),
        ).where(Communication.is_active == True)
        if company_id:
            q = q.where(Communication.company_id == uuid.UUID(company_id))
        q = q.group_by(Communication.communication_type)
        rows = (await db.execute(q)).all()
        summary = {r.communication_type: int(r.count) for r in rows}
        return f"Communication summary:\n" + json.dumps(summary, indent=2, default=str)


async def outlook_search_communications(
    query: str = "",
    company_id: str = "",
    limit: int = 20,
) -> str:
    """Search communications by subject or content."""
    async with async_session() as db:
        q = select(Communication).where(Communication.is_active == True)
        if company_id:
            q = q.where(Communication.company_id == uuid.UUID(company_id))
        if query:
            q = q.where(
                or_(
                    Communication.subject.ilike(f"%{query}%"),
                    Communication.content.ilike(f"%{query}%"),
                )
            )
        rows = (await db.execute(q.order_by(Communication.communication_date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} communications matching '{query}':\n" + json.dumps(data, indent=2, default=str)
