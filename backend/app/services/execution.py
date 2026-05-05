"""Execution systems (Node 16) — parallel fan-out via MCP servers.

Nodes 16a-16e execute in parallel after human approval (Node 15).
"""

import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.services.wiki import WikiService


@dataclass
class ExecutionResult:
    system: str
    success: bool
    message: str
    details: dict | None = None


async def execute_enquiry(enquiry: Enquiry, db: AsyncSession) -> dict:
    """Execute all downstream systems in parallel (Nodes 16a-16e)."""
    enquiry.status = EnquiryStatus.EXECUTING
    await db.commit()

    # Fan-out in parallel
    results = await asyncio.gather(
        _execute_erp(enquiry),
        _execute_sap(enquiry),
        _execute_outlook(enquiry),
        _execute_document_output(enquiry),
        _execute_wiki_update(enquiry),
        return_exceptions=True,
    )

    executions = []
    for r in results:
        if isinstance(r, Exception):
            executions.append(ExecutionResult(system="unknown", success=False, message=str(r)))
        else:
            executions.append(r)

    # Update enquiry number if ERP returned one
    for r in executions:
        if r.system == "erp" and r.success and r.details and r.details.get("enquiry_number"):
            enquiry.enquiry_number = r.details["enquiry_number"]

    enquiry.status = EnquiryStatus.COMPLETED
    await db.commit()

    return {
        "enquiry_id": str(enquiry.id),
        "status": enquiry.status.value,
        "executions": [
            {"system": r.system, "success": r.success, "message": r.message}
            for r in executions
        ],
    }


async def _execute_erp(enquiry: Enquiry) -> ExecutionResult:
    """Node 16a: ERP — create enquiry record, assign number."""
    # Stub: will be replaced by ERP MCP server
    enquiry_number = f"ENQ-{uuid.uuid4().hex[:8].upper()}"
    return ExecutionResult(
        system="erp",
        success=True,
        message=f"Created enquiry record {enquiry_number}",
        details={"enquiry_number": enquiry_number},
    )


async def _execute_sap(enquiry: Enquiry) -> ExecutionResult:
    """Node 16b: SAP — prepare sales order."""
    # Stub: will be replaced by SAP MCP server
    return ExecutionResult(system="sap", success=True, message="Sales order draft prepared")


async def _execute_outlook(enquiry: Enquiry) -> ExecutionResult:
    """Node 16c: Outlook — send approved proposal email."""
    # Stub: will be replaced by Outlook MCP server
    return ExecutionResult(
        system="outlook",
        success=True,
        message=f"Proposal email sent to {enquiry.client_email or 'client'}",
    )


async def _execute_document_output(enquiry: Enquiry) -> ExecutionResult:
    """Node 16d: Document Output — generate PDF."""
    # Stub: will be replaced by Document Output MCP server
    return ExecutionResult(
        system="document_output",
        success=True,
        message="Proposal PDF generated",
    )


async def _execute_wiki_update(enquiry: Enquiry) -> ExecutionResult:
    """Node 16e: Wiki Update — write issued proposal back to wiki."""
    wiki = WikiService()
    outcome_path = f"outcomes/{enquiry.id}.md"

    content = f"""---
type: outcome
enquiry_id: {enquiry.id}
client: {enquiry.client_name}
status: issued
---

# Outcome: {enquiry.client_name}

- Enquiry Number: {enquiry.enquiry_number or 'TBD'}
- Status: Issued
- Value: {enquiry.estimated_value or 'TBD'}
- Approved by: {enquiry.approved_by or 'N/A'}
"""
    wiki.write_page(outcome_path, content, f"Record outcome for enquiry {enquiry.id}")
    wiki.update_index()

    return ExecutionResult(
        system="wiki_update",
        success=True,
        message=f"Wiki updated with outcome at {outcome_path}",
    )
