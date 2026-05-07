"""ERP MCP Server — create enquiry records, assign numbers, update workflow."""

# PORTED — This MCP server is now registered in Next.js src/lib/mcp-gateway.ts
# Tool handlers run as async functions calling Prisma or Python microservice.

import uuid

from mcp.server.fastmcp import FastMCP

erp_mcp = FastMCP("ERP MCP", instructions="Create and manage enquiry records in the ERP system")


@erp_mcp.tool()
async def create_enquiry_record(client_name: str, description: str, value: float = 0.0) -> str:
    """Create a new enquiry record in ERP and assign an enquiry number."""
    enquiry_number = f"ENQ-{uuid.uuid4().hex[:8].upper()}"
    return f"Created enquiry {enquiry_number} for {client_name}. Value: {value}"


@erp_mcp.tool()
async def update_enquiry_status(enquiry_number: str, status: str) -> str:
    """Update the status of an existing enquiry in ERP."""
    return f"Updated enquiry {enquiry_number} to status: {status}"


@erp_mcp.tool()
async def get_enquiry_details(enquiry_number: str) -> str:
    """Retrieve enquiry details from ERP."""
    return f"Enquiry {enquiry_number}: Status=pending, Client=stub (ERP integration not yet connected)"
