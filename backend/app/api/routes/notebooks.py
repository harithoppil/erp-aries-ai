"""Notebook API — CRUD for rich text documents."""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.notebook import Notebook

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


class NotebookCreate(BaseModel):
    title: str | None = "Untitled document"
    content: str | None = "<p></p>"
    metadata_json: str | None = "{}"


class NotebookUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    metadata_json: str | None = None


class NotebookResponse(BaseModel):
    id: str
    title: str
    content: str | None
    metadata_json: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[NotebookResponse])
async def list_notebooks(db: AsyncSession = Depends(get_db)):
    """List all notebooks ordered by most recently updated."""
    stmt = select(Notebook).order_by(Notebook.updated_at.desc())
    result = await db.execute(stmt)
    notebooks = result.scalars().all()
    return [_to_response(n) for n in notebooks]


@router.post("/", response_model=NotebookResponse, status_code=201)
async def create_notebook(data: NotebookCreate, db: AsyncSession = Depends(get_db)):
    """Create a new notebook."""
    notebook = Notebook(
        title=data.title or "Untitled document",
        content=data.content or "<p></p>",
        metadata_json=data.metadata_json or "{}",
    )
    db.add(notebook)
    await db.commit()
    await db.refresh(notebook)
    return _to_response(notebook)


@router.get("/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(notebook_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get a single notebook by ID."""
    notebook = await db.get(Notebook, notebook_id)
    if not notebook:
        raise HTTPException(404, "Notebook not found")
    return _to_response(notebook)


@router.patch("/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: uuid.UUID,
    data: NotebookUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update notebook title, content, or metadata."""
    notebook = await db.get(Notebook, notebook_id)
    if not notebook:
        raise HTTPException(404, "Notebook not found")

    if data.title is not None:
        notebook.title = data.title
    if data.content is not None:
        notebook.content = data.content
    if data.metadata_json is not None:
        notebook.metadata_json = data.metadata_json
    notebook.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(notebook)
    return _to_response(notebook)


@router.delete("/{notebook_id}", status_code=204)
async def delete_notebook(notebook_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a notebook."""
    notebook = await db.get(Notebook, notebook_id)
    if not notebook:
        raise HTTPException(404, "Notebook not found")
    await db.delete(notebook)
    await db.commit()
    return None


def _to_response(n: Notebook) -> NotebookResponse:
    return NotebookResponse(
        id=str(n.id),
        title=n.title,
        content=n.content,
        metadata_json=n.metadata_json,
        created_at=n.created_at.isoformat() if n.created_at else "",
        updated_at=n.updated_at.isoformat() if n.updated_at else "",
    )
