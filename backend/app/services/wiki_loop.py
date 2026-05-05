"""Wiki Maintenance Loop (G5) — periodic wiki maintenance tasks.

Runs automatically to:
1. Re-index wiki content into RAG vector store
2. Update the wiki index.md with new pages
3. Clean up stale references
4. Generate summary pages from accumulated knowledge

Triggered by: startup, periodic cron, or manual API call.
"""

import logging
from datetime import datetime, timezone

from backend.app.services.wiki import WikiService
from backend.app.services.rag import RAGService

logger = logging.getLogger("aries.wiki_loop")


async def run_wiki_maintenance() -> dict:
    """Run the full wiki maintenance loop.

    Steps:
    1. Scan wiki for new/modified pages
    2. Update index.md with current page listing
    3. Re-index all pages into RAG store
    4. Return maintenance report
    """
    start_time = datetime.now(timezone.utc)
    report = {
        "started_at": start_time.isoformat(),
        "steps": {},
    }

    wiki = WikiService()
    rag = RAGService()

    # Step 1: Scan wiki pages
    try:
        pages = wiki.list_pages()
        report["steps"]["scan"] = {"page_count": len(pages), "status": "ok"}
        logger.info("Wiki scan: %d pages found", len(pages))
    except Exception as e:
        report["steps"]["scan"] = {"status": "failed", "error": str(e)}
        logger.error("Wiki scan failed: %s", e)
        return report

    # Step 2: Update index.md
    try:
        index_content = _generate_index(pages, wiki)
        wiki.write_page("index.md", index_content, "Wiki maintenance: auto-update index")
        report["steps"]["index_update"] = {"status": "ok", "pages_indexed": len(pages)}
        logger.info("Wiki index.md updated with %d pages", len(pages))
    except Exception as e:
        report["steps"]["index_update"] = {"status": "failed", "error": str(e)}
        logger.error("Index update failed: %s", e)

    # Step 3: Re-index into RAG
    try:
        rag_result = await rag.index_wiki_all()
        report["steps"]["rag_index"] = rag_result
        logger.info("RAG indexing: %d pages, %d chunks", rag_result["indexed_pages"], rag_result["total_chunks"])
    except Exception as e:
        report["steps"]["rag_index"] = {"status": "failed", "error": str(e)}
        logger.error("RAG indexing failed: %s", e)

    # Step 4: Check for orphaned pages (not referenced in index)
    try:
        orphans = _find_orphaned_pages(pages, wiki)
        report["steps"]["orphan_check"] = {"orphan_count": len(orphans), "orphans": orphans[:10]}
    except Exception as e:
        report["steps"]["orphan_check"] = {"status": "failed", "error": str(e)}

    end_time = datetime.now(timezone.utc)
    report["completed_at"] = end_time.isoformat()
    report["duration_seconds"] = (end_time - start_time).total_seconds()

    return report


def _generate_index(pages: list[str], wiki: WikiService) -> str:
    """Generate an index.md with all wiki pages organized by category."""
    categories: dict[str, list[tuple[str, str]]] = {
        "Entities": [],
        "Concepts": [],
        "Sources": [],
        "Outcomes": [],
        "Other": [],
    }

    for page_path in pages:
        if page_path == "index.md" or page_path == "AGENTS.md" or page_path == "log.md":
            continue

        page = wiki.read_page(page_path)
        title = page_path.replace(".md", "").split("/")[-1].replace("-", " ").title()

        # Categorize by path
        if page_path.startswith("entities/"):
            categories["Entities"].append((page_path, title))
        elif page_path.startswith("concepts/"):
            categories["Concepts"].append((page_path, title))
        elif page_path.startswith("sources/"):
            categories["Sources"].append((page_path, title))
        elif page_path.startswith("outcomes/"):
            categories["Outcomes"].append((page_path, title))
        else:
            categories["Other"].append((page_path, title))

    lines = [
        "# Aries Knowledge Base Index",
        "",
        f"_Last updated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}_",
        "",
    ]

    for category, items in categories.items():
        if not items:
            continue
        lines.append(f"## {category}")
        lines.append("")
        for path, title in sorted(items, key=lambda x: x[1]):
            lines.append(f"- [{title}]({path})")
        lines.append("")

    return "\n".join(lines)


def _find_orphaned_pages(pages: list[str], wiki: WikiService) -> list[str]:
    """Find pages that aren't linked from any other page."""
    # Read all page contents and collect links
    all_links: set[str] = set()
    for page_path in pages:
        page = wiki.read_page(page_path)
        if not page:
            continue
        # Extract markdown links: [text](path)
        import re
        links = re.findall(r'\[([^\]]*)\]\(([^)]+\.md)\)', page.content)
        for _, link_path in links:
            all_links.add(link_path)

    # Find pages not in any link set
    orphans = []
    for page_path in pages:
        if page_path in ("index.md", "AGENTS.md", "log.md"):
            continue
        if page_path not in all_links:
            orphans.append(page_path)

    return orphans
