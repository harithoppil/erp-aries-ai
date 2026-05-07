"""Outlook MCP Server — send approved proposals and client updates via email."""

# PORTED — This MCP server is now registered in Next.js src/lib/mcp-gateway.ts
# Tool handlers run as async functions calling Prisma or Python microservice.

from mcp.server.fastmcp import FastMCP

outlook_mcp = FastMCP("Outlook MCP", instructions="Send approved proposal emails and client updates via Outlook")


@outlook_mcp.tool()
async def send_proposal_email(to: str, client_name: str, subject: str, body: str) -> str:
    """Send a proposal email to a client via Outlook."""
    return f"Proposal email sent to {to} ({client_name}). Subject: {subject}. Stub: Outlook not yet connected."


@outlook_mcp.tool()
async def send_client_update(to: str, subject: str, body: str) -> str:
    """Send a general client update email via Outlook."""
    return f"Client update sent to {to}. Subject: {subject}. Stub: Outlook not yet connected."
