"""Shared wiki context builder — eliminates duplicate wiki-retrieval extraction.

Multiple files in the codebase build wiki context by:
1. Searching wiki for relevant pages
2. Reading each page's content
3. Joining them into a context string

This module provides a single shared implementation so that all callers
can converge on one place. Existing callers should migrate to this helper
and remove their local implementations.
"""

import logging

logger = logging.getLogger("aries.wiki_context")


async def build_wiki_context(query: str, limit: int = 5) -> str:
    """Search wiki for relevant pages and build context string.

    Args:
        query: The search query (typically the user's message or enquiry terms).
        limit: Maximum number of wiki pages to include.

    Returns:
        A string with wiki page contents joined by separators,
        or empty string if no results found.
    """
    from backend.app.services.wiki import WikiService

    wiki = WikiService()
    results = wiki.search(query, limit=limit)
    if not results:
        return ""

    context_parts = []
    for r in results[:limit]:
        page = wiki.read_page(r.path)
        if page:
            context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")

    return "\n\n---\n\n".join(context_parts) if context_parts else ""
