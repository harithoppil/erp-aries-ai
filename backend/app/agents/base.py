"""Agent base class and sub-agent implementations (Node 14).

Ingest Agent, Query Agent, Drafting Agent, Execute Agent.
Each operates on the wiki repo and calls MCP servers via the gateway.
"""

import uuid
from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.mcp_servers.gateway import gateway
from backend.app.models.enquiry import Enquiry
from backend.app.services.wiki import WikiService
from backend.app.services.gemini import GeminiService
from backend.app.services.rules import apply_rules


class BaseAgent(ABC):
    """Base class for all Aries sub-agents."""

    name: str = "base"

    def __init__(self):
        self.wiki = WikiService()
        self.gemini = GeminiService()

    @abstractmethod
    async def run(self, context: dict) -> dict:
        """Execute the agent's task. Returns result dict."""
        ...


class IngestAgent(BaseAgent):
    """Ingest Agent — runs MarkItDown, writes source pages, updates entity pages."""

    name = "ingest"

    async def run(self, context: dict) -> dict:
        enquiry_id = context.get("enquiry_id")
        filename = context.get("filename", "unknown")
        markdown = context.get("markdown", "")

        # Write source page
        source_path = f"sources/{enquiry_id}/{filename}.md"
        self.wiki.write_page(
            source_path,
            f"---\ntype: source\nenquiry_id: {enquiry_id}\nfile: {filename}\n---\n\n# Source: {filename}\n\n{markdown}",
            f"Ingest: {filename}",
        )

        # Update index
        self.wiki.update_index()
        self.wiki.append_to_log("ingest", filename, f"Enquiry {enquiry_id}")

        return {"status": "completed", "source_page": source_path}


class QueryAgent(BaseAgent):
    """Query Agent — answers questions against the wiki + raw sources."""

    name = "query"

    async def run(self, context: dict) -> dict:
        question = context.get("question", "")
        search_results = self.wiki.search(question, limit=10)

        wiki_context = ""
        for r in search_results:
            page = self.wiki.read_page(r.path)
            if page:
                wiki_context += f"\n## {r.title}\n{page.content[:2000]}\n"

        answer = await self.gemini.answer_query(question, wiki_context)

        # Optionally file the answer back into the wiki
        if context.get("save_answer"):
            answer_path = f"concepts/query-{uuid.uuid4().hex[:8]}.md"
            self.wiki.write_page(
                answer_path,
                f"---\ntype: concept\ncategory: query-result\n---\n\n# Q: {question}\n\n{answer}",
                f"Save query result: {question[:50]}",
            )

        return {"answer": answer, "sources_used": [r.path for r in search_results]}


class DraftingAgent(BaseAgent):
    """Drafting Agent — produces proposal draft (output of Phase 3)."""

    name = "drafting"

    async def run(self, context: dict) -> dict:
        enquiry: Enquiry | None = context.get("enquiry")

        if not enquiry:
            return {"status": "error", "message": "No enquiry provided"}

        # Wiki-first retrieval
        wiki_context = ""
        index = self.wiki.read_page("index.md")
        if index:
            wiki_context += index.content

        for term in [enquiry.client_name, enquiry.industry or ""]:
            if term:
                results = self.wiki.search(term, limit=5)
                for r in results:
                    page = self.wiki.read_page(r.path)
                    if page:
                        wiki_context += f"\n## {r.title}\n{page.content[:2000]}\n"

        # Rules before LLM
        rules = apply_rules(
            estimated_value=enquiry.estimated_value,
            estimated_cost=enquiry.estimated_cost,
            industry=enquiry.industry,
        )

        # Classify
        classification = await self.gemini.classify_enquiry(enquiry, wiki_context)

        # LLM draft
        draft = await self.gemini.draft_proposal(enquiry, wiki_context, rules, classification)

        return {
            "status": "completed",
            "draft": draft,
            "classification": classification,
            "rules_output": {
                "min_margin_pct": rules.min_margin_pct,
                "policy_violations": rules.policy_violations,
                "suggested_template": rules.suggested_template,
            },
        }


class ExecuteAgent(BaseAgent):
    """Execute Agent — fans out across MCP servers once approved."""

    name = "execute"

    async def run(self, context: dict) -> dict:
        from backend.app.services.execution import execute_enquiry
        from backend.app.core.database import async_session

        enquiry = context.get("enquiry")
        if not enquiry:
            return {"status": "error", "message": "No enquiry provided"}

        async with async_session() as db:
            result = await execute_enquiry(enquiry, db)

        return result
