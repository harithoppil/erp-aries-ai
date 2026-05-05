"""Wiki MCP Server — read/write/search the wiki repo via MCP protocol."""

from mcp.server.fastmcp import FastMCP

from backend.app.services.wiki import WikiService

wiki_mcp = FastMCP("Wiki MCP", instructions="Read, write, and search the LLM Wiki repository")


@wiki_mcp.tool()
async def wiki_read(path: str) -> str:
    """Read a wiki page by path (e.g. 'entities/acme-corp.md')."""
    wiki = WikiService()
    page = wiki.read_page(path)
    return page.content if page else f"Page not found: {path}"


@wiki_mcp.tool()
async def wiki_write(path: str, content: str, commit_message: str = "MCP write") -> str:
    """Write or update a wiki page. Creates git commit automatically."""
    wiki = WikiService()
    page = wiki.write_page(path, content, commit_message)
    return f"Written: {page.path} (commit: {page.last_commit})"


@wiki_mcp.tool()
async def wiki_search(query: str, limit: int = 10) -> str:
    """Search the wiki for relevant pages."""
    wiki = WikiService()
    results = wiki.search(query, limit=limit)
    if not results:
        return "No results found."
    return "\n".join(f"- [{r.title}]({r.path}) (score: {r.score:.1f}): {r.snippet}" for r in results)


@wiki_mcp.tool()
async def wiki_list_pages() -> str:
    """List all pages in the wiki."""
    wiki = WikiService()
    pages = wiki.list_pages()
    return "\n".join(pages) if pages else "Wiki is empty."


@wiki_mcp.tool()
async def wiki_update_index() -> str:
    """Regenerate the wiki index page."""
    wiki = WikiService()
    wiki.update_index()
    return "Index updated."
