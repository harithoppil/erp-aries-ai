"""Search MCP Server — Vertex AI Search + local hybrid retrieval."""

# PORTED — This MCP server is now registered in Next.js src/lib/mcp-gateway.ts
# Tool handlers run as async functions calling Prisma or Python microservice.

from mcp.server.fastmcp import FastMCP

from backend.app.services.wiki import WikiService

search_mcp = FastMCP("Search MCP", instructions="Hybrid search over wiki and raw sources")


@search_mcp.tool()
async def search_wiki(query: str, limit: int = 10) -> str:
    """Search the wiki repository using local text search."""
    wiki = WikiService()
    results = wiki.search(query, limit=limit)
    if not results:
        return "No results found."
    lines = []
    for r in results:
        lines.append(f"## {r.title} ({r.path}) [score: {r.score:.1f}]")
        lines.append(f"{r.snippet}\n")
    return "\n".join(lines)


@search_mcp.tool()
async def search_vertex(query: str) -> str:
    """Search using Vertex AI Search (placeholder — requires configured data store)."""
    # TODO: Implement Vertex AI Search integration
    return "Vertex AI Search not yet configured. Use search_wiki for local search."


@search_mcp.tool()
async def wiki_index_first(query: str) -> str:
    """Index-first navigation: read index.md and find relevant entries."""
    wiki = WikiService()
    index = wiki.read_page("index.md")
    if not index:
        return "No index found."
    return f"# Wiki Index\n\n{index.content}"
