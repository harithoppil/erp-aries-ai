import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from backend.app.models.enquiry import EnquiryStatus


# --- Enquiry ---
class EnquiryCreate(BaseModel):
    client_name: str
    client_email: str | None = None
    channel: str = "web"
    industry: str | None = None
    subdivision: str | None = None
    description: str


class EnquiryUpdate(BaseModel):
    client_name: str | None = None
    client_email: str | None = None
    industry: str | None = None
    subdivision: str | None = None
    description: str | None = None
    estimated_value: float | None = None
    estimated_cost: float | None = None
    status: EnquiryStatus | None = None
    approved_by: str | None = None


class EnquiryRead(BaseModel):
    id: uuid.UUID
    enquiry_number: str | None
    client_name: str
    client_email: str | None
    channel: str
    industry: str | None
    subdivision: str | None
    description: str
    status: EnquiryStatus
    estimated_value: float | None
    estimated_cost: float | None
    estimated_margin: float | None
    scope_category: str | None
    complexity: str | None
    approved_by: str | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Document ---
class DocumentRead(BaseModel):
    id: uuid.UUID
    enquiry_id: uuid.UUID
    filename: str
    content_type: str
    storage_path: str
    wiki_source_page: str | None
    processing_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Wiki ---
class WikiPageCreate(BaseModel):
    path: str = Field(..., description="Relative path within wiki, e.g. entities/acme-corp.md")
    content: str
    commit_message: str = "Add page"


class WikiPageUpdate(BaseModel):
    content: str
    commit_message: str = "Update page"


class WikiPageRead(BaseModel):
    path: str
    content: str
    last_modified: datetime | None = None
    last_commit: str | None = None


class WikiSearchResult(BaseModel):
    path: str
    title: str
    snippet: str
    score: float


# --- Pipeline ---
class PipelineRunRequest(BaseModel):
    enquiry_id: uuid.UUID


class PipelineRunResponse(BaseModel):
    enquiry_id: uuid.UUID
    status: str
    message: str
    wiki_pages_created: list[str] = []
    rules_output: dict | None = None
    llm_draft: str | None = None
