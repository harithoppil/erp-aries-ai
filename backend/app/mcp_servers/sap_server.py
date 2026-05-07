"""SAP MCP Server — prepare sales orders and transactional drafts."""

# PORTED — This MCP server is now registered in Next.js src/lib/mcp-gateway.ts
# Tool handlers run as async functions calling Prisma or Python microservice.

from mcp.server.fastmcp import FastMCP

sap_mcp = FastMCP("SAP MCP", instructions="Prepare sales orders and transactional drafts in SAP")


@sap_mcp.tool()
async def prepare_sales_order(enquiry_number: str, client_name: str, items: str) -> str:
    """Prepare a sales order draft in SAP."""
    return f"Sales order draft prepared for enquiry {enquiry_number} ({client_name}). Items: {items}. Stub: SAP not yet connected."


@sap_mcp.tool()
async def create_transactional_draft(enquiry_number: str, value: float) -> str:
    """Create a transactional draft in SAP."""
    return f"Transactional draft created for enquiry {enquiry_number}. Value: {value}. Stub: SAP not yet connected."
