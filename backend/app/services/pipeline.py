"""AI Decisioning Pipeline — Nodes 9-13.

Wiki-first retrieval → Gemini classification → Rules engine → LLM reasoning → Policy gate.
All Gemini failures are caught and surfaced — no silent swallowing.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

# TODO: Migrate _wiki_retrieval to use shared helper from backend.app.services.wiki_context.build_wiki_context

from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.schemas.enquiry import PipelineRunResponse
from backend.app.services.rules import apply_rules, RulesOutput
from backend.app.services.wiki import WikiService
from backend.app.services.gemini import GeminiService, GeminiError

logger = logging.getLogger("aries.pipeline")


async def run_pipeline(enquiry: Enquiry, db: AsyncSession) -> PipelineRunResponse:
    """Run the full decisioning pipeline for an enquiry (Nodes 9→13)."""

    # Node 9: Wiki-first retrieval
    wiki = WikiService()
    wiki_context = await _wiki_retrieval(enquiry, wiki)

    # Node 10: Gemini Structured Classification
    try:
        classification = await _classify_enquiry(enquiry, wiki_context)
        enquiry.scope_category = classification.get("category")
        enquiry.complexity = classification.get("complexity")
        enquiry.resource_profile = classification.get("resource_profile")
    except GeminiError as e:
        logger.error("Pipeline classification failed for enquiry %s: %s", enquiry.id, e)
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
        await db.commit()
        return PipelineRunResponse(
            enquiry_id=enquiry.id,
            status="classification_failed",
            message=f"AI classification failed: {e}. Manual classification required.",
        )

    enquiry.status = EnquiryStatus.CLASSIFIED
    await db.commit()

    # Node 11: Rules Engine — ALWAYS before LLM
    rules_output = apply_rules(
        estimated_value=enquiry.estimated_value,
        estimated_cost=enquiry.estimated_cost,
        industry=enquiry.industry,
        subdivision=enquiry.subdivision,
    )
    enquiry.status = EnquiryStatus.RULES_APPLIED
    await db.commit()

    # Node 12: LLM Reasoning (Gemini 3.1 Pro)
    try:
        gemini = GeminiService()
        llm_draft = await gemini.draft_proposal(
            enquiry=enquiry,
            wiki_context=wiki_context,
            rules_output=rules_output,
            classification=classification,
        )
    except GeminiError as e:
        logger.error("Pipeline LLM drafting failed for enquiry %s: %s", enquiry.id, e)
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
        await db.commit()
        return PipelineRunResponse(
            enquiry_id=enquiry.id,
            status="drafting_failed",
            message=f"AI drafting failed: {e}. Manual draft required.",
            rules_output=_rules_to_dict(rules_output),
            classification=classification,
        )

    enquiry.status = EnquiryStatus.LLM_DRAFTED
    await db.commit()

    # Node 13: Policy validation gate
    if rules_output.policy_violations:
        enquiry.status = EnquiryStatus.HUMAN_REVIEW
        await db.commit()
        return PipelineRunResponse(
            enquiry_id=enquiry.id,
            status="human_review_required",
            message=f"Policy violations: {'; '.join(rules_output.policy_violations)}",
            rules_output=_rules_to_dict(rules_output),
            llm_draft=llm_draft,
        )

    enquiry.status = EnquiryStatus.POLICY_REVIEW
    await db.commit()

    return PipelineRunResponse(
        enquiry_id=enquiry.id,
        status="policy_review",
        message="Draft generated, awaiting human approval",
        rules_output=_rules_to_dict(rules_output),
        llm_draft=llm_draft,
    )


async def _wiki_retrieval(enquiry: Enquiry, wiki: WikiService) -> str:
    """Node 9: Wiki-first retrieval. Read index.md, follow links to relevant pages."""
    index = wiki.read_page("index.md")
    context_parts = [f"# Wiki Index\n{index.content}"] if index else []

    search_terms = [enquiry.client_name]
    if enquiry.industry:
        search_terms.append(enquiry.industry)
    if enquiry.scope_category:
        search_terms.append(enquiry.scope_category)

    for term in search_terms:
        results = wiki.search(term, limit=5)
        for r in results:
            page = wiki.read_page(r.path)
            if page:
                context_parts.append(f"## {r.title} ({r.path})\n{page.content[:2000]}")

    return "\n\n---\n\n".join(context_parts) if context_parts else "No wiki context available."


async def _classify_enquiry(enquiry: Enquiry, wiki_context: str) -> dict:
    """Node 10: Gemini Structured Classification (replaces ML)."""
    gemini = GeminiService()
    return await gemini.classify_enquiry(enquiry, wiki_context)


def _rules_to_dict(rules: RulesOutput) -> dict:
    return {
        "min_margin_pct": rules.min_margin_pct,
        "approval_threshold_value": rules.approval_threshold_value,
        "suggested_template": rules.suggested_template,
        "requires_two_person_approval": rules.requires_two_person_approval,
        "policy_violations": rules.policy_violations,
        "pricing_adjustments": rules.pricing_adjustments,
    }
